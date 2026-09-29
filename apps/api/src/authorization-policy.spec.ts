import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ROLES_KEY } from './auth/decorators/roles.decorator';
import { ApiKeyGuard } from './servers/guards/api-key.guard';

// Static authorization-policy check ("policy as code"). It discovers EVERY
// controller route in the codebase and fails the build when:
//   1. a route has no authentication guard and is not a deliberately public route;
//   2. a route declares @Roles(...) without RolesGuard — the roles would be
//      silently ignored, giving a false sense of security;
//   3. a state-changing route under JWT declares no roles at all, unless it is
//      listed below with a justification.
// This catches the most common access-control regression: someone adds a new
// endpoint and forgets the guards.
type Guard = abstract new (...args: never[]) => unknown;

const PUBLIC_ROUTES = new Set([
  'GET /',
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/accept-invitation',
]);

const MUTATING_WITHOUT_ROLES = new Map([
  ['POST /rag/query', 'read-only question answering, available to every role'],
  [
    'POST /rag/reindex',
    'OPEN POLICY QUESTION: any role, incl. VIEWER, can trigger a full re-embedding',
  ],
]);

interface Route {
  id: string;
  guards: Guard[];
  roles: string[] | undefined;
}

function discoverRoutes(): Route[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.controller.ts')) files.push(full);
    }
  };
  walk(__dirname);

  const routes: Route[] = [];
  for (const file of files) {
    // Routes are discovered at runtime, so the module path is only known here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported = require(file) as Record<string, unknown>;
    for (const candidate of Object.values(exported)) {
      if (typeof candidate !== 'function') continue;
      const controller = candidate as { prototype: Record<string, unknown> };
      const base = Reflect.getMetadata(PATH_METADATA, controller) as
        string | undefined;
      if (base === undefined) continue;
      const classGuards =
        (Reflect.getMetadata(GUARDS_METADATA, controller) as Guard[]) ?? [];

      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (method === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const full = `/${[base, sub].filter((p) => p && p !== '/').join('/')}`;
        routes.push({
          id: `${RequestMethod[method]} ${full.replace(/\/+/g, '/')}`,
          guards: [
            ...classGuards,
            ...((Reflect.getMetadata(GUARDS_METADATA, handler) as Guard[]) ??
              []),
          ],
          roles: Reflect.getMetadata(ROLES_KEY, handler) as
            string[] | undefined,
        });
      }
    }
  }
  return routes;
}

describe('Authorization policy (static route scan)', () => {
  const routes = discoverRoutes();

  it('discovers the application’s routes (sanity check)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(30);
  });

  it('every non-public route requires JWT or an agent API key', () => {
    const unguarded = routes
      .filter((r) => !PUBLIC_ROUTES.has(r.id))
      .filter(
        (r) =>
          !r.guards.includes(JwtAuthGuard) && !r.guards.includes(ApiKeyGuard),
      )
      .map((r) => r.id);

    expect(unguarded).toEqual([]);
  });

  it('every route that declares @Roles also applies RolesGuard', () => {
    const ignoredRoles = routes
      .filter((r) => r.roles && r.roles.length > 0)
      .filter((r) => !r.guards.includes(RolesGuard))
      .map((r) => r.id);

    expect(ignoredRoles).toEqual([]);
  });

  it('every state-changing JWT route declares roles, or is justified here', () => {
    const undeclared = routes
      .filter((r) => r.guards.includes(JwtAuthGuard))
      .filter((r) => !r.id.startsWith('GET '))
      .filter((r) => !r.roles || r.roles.length === 0)
      .filter((r) => !MUTATING_WITHOUT_ROLES.has(r.id))
      .map((r) => r.id);

    expect(undeclared).toEqual([]);
  });

  it('the public route list contains only routes that still exist', () => {
    const ids = new Set(routes.map((r) => r.id));
    for (const route of PUBLIC_ROUTES) expect(ids).toContain(route);
  });
});
