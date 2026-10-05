import { Test, TestingModuleBuilder } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

// Boots the REAL application (all modules, guards, validation, middleware) on
// Fastify — the same HTTP platform as production — backed by the test database.
// `customise` lets a suite replace one collaborator (e.g. the AI service client).
export async function createTestApp(
  customise?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (customise) builder = customise(builder);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, prisma: app.get(PrismaService), close: () => app.close() };
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiResponse<T> {
  status: number;
  body: T;
}

export interface RequestOptions {
  token?: string;
  apiKey?: string;
  body?: unknown;
  rawBody?: string;
}

// In-process HTTP call via Fastify's inject(): the request goes through the full
// framework pipeline without opening a network port.
export async function request<T = Record<string, unknown>>(
  app: NestFastifyApplication,
  method: HttpMethod,
  url: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.apiKey) headers['x-api-key'] = options.apiKey;
  if (options.rawBody !== undefined)
    headers['content-type'] = 'application/json';

  const res = await app.inject({
    method,
    url,
    headers,
    ...(options.rawBody !== undefined
      ? { payload: options.rawBody }
      : options.body !== undefined
        ? { payload: options.body as Record<string, unknown> }
        : {}),
  });

  let body: T;
  try {
    body = JSON.parse(res.body) as T;
  } catch {
    body = res.body as unknown as T;
  }
  return { status: res.statusCode, body };
}

// Polls until `check` passes — for fire-and-forget work such as request logging.
export async function eventually(
  check: () => Promise<boolean>,
  timeoutMs = 3000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return check();
}
