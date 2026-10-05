import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Organization, Prisma, Role, Rule, Server, User } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

export const TEST_PASSWORD = 'Correct-Horse-9';
// Cost factor 4 keeps the suite fast; production uses 10. Only speed differs.
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

export const ALL_ROLES: Role[] = [
  'OWNER',
  'ADMIN',
  'SECURITY_ANALYST',
  'DEVOPS_ENGINEER',
  'DEVELOPER',
  'VIEWER',
];

const jwt = new JwtService({});

export function accessTokenFor(
  user: Pick<User, 'id' | 'email' | 'role' | 'organizationId'>,
  options: { secret?: string; expiresIn?: number } = {},
): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    {
      secret: options.secret ?? process.env.JWT_ACCESS_SECRET,
      expiresIn: options.expiresIn ?? 900,
    },
  );
}

export interface Tenant {
  org: Organization;
  users: Record<Role, User>;
  tokens: Record<Role, string>;
  server: Server;
}

let sequence = 0;
const unique = () => `${++sequence}${randomBytes(3).toString('hex')}`;

// One organization with a user for every role and one monitored server.
export async function createTenant(
  prisma: PrismaService,
  label: string,
): Promise<Tenant> {
  const id = unique();
  const org = await prisma.organization.create({
    data: { name: `${label} Org ${id}` },
  });

  const users = {} as Record<Role, User>;
  const tokens = {} as Record<Role, string>;
  for (const role of ALL_ROLES) {
    const user = await prisma.user.create({
      data: {
        email: `${role.toLowerCase()}.${label.toLowerCase()}.${id}@example.com`,
        passwordHash: PASSWORD_HASH,
        role,
        organizationId: org.id,
      },
    });
    users[role] = user;
    tokens[role] = accessTokenFor(user);
  }

  const server = await createServer(prisma, org.id, `${label}-web-01`);
  return { org, users, tokens, server };
}

export function createServer(
  prisma: PrismaService,
  organizationId: string,
  name = `srv-${unique()}`,
): Promise<Server> {
  return prisma.server.create({
    data: {
      name,
      hostname: `${name}.internal`,
      apiKey: `isk_test_${unique()}${randomBytes(12).toString('hex')}`,
      organizationId,
    },
  });
}

export function createRule(
  prisma: PrismaService,
  organizationId: string,
  data: Partial<Prisma.RuleUncheckedCreateInput> = {},
): Promise<Rule> {
  return prisma.rule.create({
    data: {
      name: `rule-${unique()}`,
      ruleType: 'METRIC_THRESHOLD',
      metricField: 'CPU_USAGE',
      operator: 'GREATER_THAN',
      threshold: 80,
      durationSeconds: 60,
      severity: 'MEDIUM',
      ...data,
      organizationId,
    },
  });
}

// An incident with one alert, as the correlation engine would produce.
export async function createIncidentWithAlert(
  prisma: PrismaService,
  tenant: Pick<Tenant, 'org' | 'server'>,
) {
  const rule = await createRule(prisma, tenant.org.id);
  const incident = await prisma.incident.create({
    data: {
      title: `${rule.name} incident`,
      severity: 'HIGH',
      organizationId: tenant.org.id,
    },
  });
  const alert = await prisma.alert.create({
    data: {
      ruleId: rule.id,
      serverId: tenant.server.id,
      incidentId: incident.id,
      details: { value: 97, metricField: 'CPU_USAGE', threshold: 80 },
    },
  });
  return { rule, incident, alert };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "IncidentEmbedding", "Alert", "Incident", "Metric", "Event", "Rule", "Server", "Invitation", "User", "Organization" CASCADE',
  );
}
