import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnomalyService } from '../anomaly/anomaly.service';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private prisma: PrismaService,
    private anomalyService: AnomalyService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async correlateAlertsIntoIncidents() {
    const uncorrelatedAlerts = await this.prisma.alert.findMany({
      where: { status: 'OPEN', incidentId: null },
      include: { rule: true },
    });

    if (uncorrelatedAlerts.length === 0) return;

    this.logger.debug(
      `Correlation check: ${uncorrelatedAlerts.length} uncorrelated open alert(s)`,
    );

    // Group alerts by organization (since rule.organizationId tells us which org each belongs to)
    const byOrg = new Map<string, typeof uncorrelatedAlerts>();
    for (const alert of uncorrelatedAlerts) {
      const orgId = alert.rule.organizationId;
      if (!byOrg.has(orgId)) byOrg.set(orgId, []);
      byOrg.get(orgId)!.push(alert);
    }

    for (const [organizationId, alerts] of byOrg.entries()) {
      // Simple correlation: group alerts from the same server within a 5-minute window into one incident
      const bySerer = new Map<string, typeof alerts>();
      for (const alert of alerts) {
        const key = alert.serverId ?? 'no-server'; // event-frequency alerts have no serverId
        if (!bySerer.has(key)) bySerer.set(key, []);
        bySerer.get(key)!.push(alert);
      }

      for (const [, groupedAlerts] of bySerer.entries()) {
        const highestSeverity = this.pickHighestSeverity(
          groupedAlerts.map((a) => a.rule.severity),
        );
        const primaryRuleName = groupedAlerts[0].rule.name;
        const title =
          groupedAlerts.length === 1
            ? primaryRuleName
            : `${primaryRuleName} + ${groupedAlerts.length - 1} more alert(s)`;

        const incident = await this.prisma.incident.create({
          data: {
            title,
            severity: highestSeverity,
            organizationId,
          },
        });

        await this.prisma.alert.updateMany({
          where: { id: { in: groupedAlerts.map((a) => a.id) } },
          data: { incidentId: incident.id },
        });

        this.logger.warn(
          `Incident created: ${incident.id} grouping ${groupedAlerts.length} alert(s)`,
        );
      }
    }
  }

  private pickHighestSeverity(
    severities: string[],
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    let highest = 'LOW';

    for (const s of severities) {
      if (order.indexOf(s) > order.indexOf(highest)) {
        highest = s;
      }
    }

    return highest as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async evaluateRules() {
    this.logger.debug('Rule engine tick — checking active rules');

    const activeMetricRules = await this.prisma.rule.findMany({
      where: {
        ruleType: 'METRIC_THRESHOLD',
        isActive: true,
      },
    });

    this.logger.debug(
      `Found ${activeMetricRules.length} active metric rule(s)`,
    );

    for (const rule of activeMetricRules) {
      await this.evaluateMetricRule(rule);
    }

    const activeEventRules = await this.prisma.rule.findMany({
      where: {
        ruleType: 'EVENT_FREQUENCY',
        isActive: true,
      },
    });

    this.logger.debug(
      `Found ${activeEventRules.length} active event-frequency rule(s)`,
    );

    for (const rule of activeEventRules) {
      await this.evaluateEventRule(rule);
    }

    const activeHeartbeatRules = await this.prisma.rule.findMany({
      where: {
        ruleType: 'HEARTBEAT_MISSING',
        isActive: true,
      },
    });

    this.logger.debug(
      `Found ${activeHeartbeatRules.length} active heartbeat rule(s)`,
    );

    for (const rule of activeHeartbeatRules) {
      await this.evaluateHeartbeatRule(rule);
    }
    const activeCredStuffingRules = await this.prisma.rule.findMany({
      where: {
        ruleType: 'CREDENTIAL_STUFFING',
        isActive: true,
      },
    });

    this.logger.debug(
      `Found ${activeCredStuffingRules.length} active credential-stuffing rule(s)`,
    );

    for (const rule of activeCredStuffingRules) {
      await this.evaluateCredentialStuffingRule(rule);
    }
    const activeAnomalyRules = await this.prisma.rule.findMany({
      where: {
        ruleType: 'ANOMALY_DETECTION',
        isActive: true,
      },
    });

    this.logger.debug(
      `Found ${activeAnomalyRules.length} active anomaly-detection rule(s)`,
    );

    for (const rule of activeAnomalyRules) {
      await this.evaluateAnomalyRule(rule);
    }
  }

  private async evaluateMetricRule(rule: {
    id: string;
    organizationId: string;
    metricField: string | null;
    operator: string | null;
    threshold: number | null;
    durationSeconds: number;
    severity: string;
  }) {
    if (!rule.metricField || !rule.operator || rule.threshold === null) return;

    const servers = await this.prisma.server.findMany({
      where: { organizationId: rule.organizationId },
    });

    this.logger.debug(
      `Rule "${rule.id}": checking ${servers.length} server(s) in org ${rule.organizationId}`,
    );

    for (const server of servers) {
      const windowStart = new Date(Date.now() - rule.durationSeconds * 1000);

      const recentMetrics = await this.prisma.metric.findMany({
        where: { serverId: server.id, timestamp: { gte: windowStart } },
        orderBy: { timestamp: 'asc' },
      });

      this.logger.debug(
        `Server "${server.name}": found ${recentMetrics.length} metric(s) in last ${rule.durationSeconds}s`,
      );

      if (recentMetrics.length === 0) continue;

      const fieldMap: Record<string, keyof (typeof recentMetrics)[0]> = {
        CPU_USAGE: 'cpuUsage',
        MEM_USAGE: 'memUsage',
        DISK_USAGE: 'diskUsage',
        NETWORK_IN: 'networkIn',
        NETWORK_OUT: 'networkOut',
        DISK_READ_RATE: 'diskReadRate',
        DISK_WRITE_RATE: 'diskWriteRate',
        PROCESS_COUNT: 'processCount',
        LOAD_AVERAGE: 'loadAverage',
      };
      const field = fieldMap[rule.metricField];

      const values = recentMetrics.map((m) => m[field] as number);
      this.logger.debug(
        `Server "${server.name}": ${rule.metricField} values in window: [${values.join(', ')}]`,
      );

      const hasNulls = recentMetrics.some((m) => m[field] === null);
      if (hasNulls) {
        this.logger.debug(
          `Server "${server.name}": skipping — window contains null values for ${rule.metricField}`,
        );
        continue;
      }

      const allBreached = recentMetrics.every((m) => {
        const value = m[field] as number;
        return rule.operator === 'GREATER_THAN'
          ? value > rule.threshold!
          : value < rule.threshold!;
      });

      this.logger.debug(
        `Server "${server.name}": all readings breach threshold (${rule.threshold})? ${allBreached}`,
      );

      if (!allBreached) continue;

      const existingOpenAlert = await this.prisma.alert.findFirst({
        where: { ruleId: rule.id, serverId: server.id, status: 'OPEN' },
      });
      if (existingOpenAlert) {
        this.logger.debug(
          `Server "${server.name}": alert already OPEN, skipping duplicate`,
        );
        continue;
      }

      const latestValue = recentMetrics[recentMetrics.length - 1][
        field
      ] as number;

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          serverId: server.id,
          details: {
            value: latestValue,
            metricField: rule.metricField,
            threshold: rule.threshold,
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: ${rule.metricField} rule "${rule.id}" breached on server ${server.name}`,
      );
    }
  }

  private async evaluateHeartbeatRule(rule: {
    id: string;
    organizationId: string;
    durationSeconds: number;
    severity: string;
  }) {
    const servers = await this.prisma.server.findMany({
      where: { organizationId: rule.organizationId },
    });

    const cutoff = new Date(Date.now() - rule.durationSeconds * 1000);

    for (const server of servers) {
      if (!server.lastHeartbeat) continue;

      const isMissing = server.lastHeartbeat < cutoff;
      if (!isMissing) continue;

      const existingOpenAlert = await this.prisma.alert.findFirst({
        where: { ruleId: rule.id, serverId: server.id, status: 'OPEN' },
      });
      if (existingOpenAlert) continue;

      const secondsSinceLastHeartbeat = Math.floor(
        (Date.now() - server.lastHeartbeat.getTime()) / 1000,
      );

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          serverId: server.id,
          details: {
            lastHeartbeat: server.lastHeartbeat.toISOString(),
            secondsSinceLastHeartbeat,
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: server "${server.name}" heartbeat missing for ${secondsSinceLastHeartbeat}s (rule "${rule.id}")`,
      );
    }
  }

  private async evaluateCredentialStuffingRule(rule: {
    id: string;
    organizationId: string;
    windowSeconds: number | null;
    maxCount: number | null;
    severity: string;
  }) {
    if (!rule.windowSeconds || !rule.maxCount) return;

    const windowStart = new Date(Date.now() - rule.windowSeconds * 1000);

    // Get every login attempt (success or failure) in the window, for this org
    const recentAttempts = await this.prisma.event.findMany({
      where: {
        eventType: { in: ['AUTH_LOGIN_FAILURE', 'AUTH_LOGIN_SUCCESS'] },
        createdAt: { gte: windowStart },
        OR: [{ organizationId: rule.organizationId }, { organizationId: null }],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by email — we're looking for "one account, attacked from many IPs, then a success"
    const byEmail = new Map<string, typeof recentAttempts>();
    for (const event of recentAttempts) {
      const metadata = event.metadata as Record<string, unknown>;
      const email = metadata.email as string | undefined;
      if (!email) continue;

      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email)!.push(event);
    }

    for (const [email, attempts] of byEmail.entries()) {
      const failures = attempts.filter(
        (a) => a.eventType === 'AUTH_LOGIN_FAILURE',
      );
      const lastAttempt = attempts[attempts.length - 1];
      const endedInSuccess = lastAttempt.eventType === 'AUTH_LOGIN_SUCCESS';

      if (!endedInSuccess) continue; // credential stuffing only matters if they eventually got in

      const distinctIps = new Set(
        failures.map(
          (f) => (f.metadata as Record<string, unknown>).ipAddress as string,
        ),
      );

      if (distinctIps.size < rule.maxCount) continue;

      const existingOpenAlert = await this.prisma.alert.findFirst({
        where: {
          ruleId: rule.id,
          status: 'OPEN',
          details: { path: ['email'], equals: email },
        },
      });
      if (existingOpenAlert) continue;

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          details: {
            email,
            distinctIpCount: distinctIps.size,
            ipAddresses: Array.from(distinctIps),
            totalFailures: failures.length,
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: possible credential stuffing on "${email}" — ${distinctIps.size} distinct IPs before success (rule "${rule.id}")`,
      );
    }
  }
  private async evaluateAnomalyRule(rule: {
    id: string;
    organizationId: string;
    severity: string;
  }) {
    const servers = await this.prisma.server.findMany({
      where: { organizationId: rule.organizationId },
    });

    for (const server of servers) {
      const score = await this.anomalyService.getAnomalyScore(server.id);

      if (!score || !score.isAnomaly) continue;

      const existingOpenAlert = await this.prisma.alert.findFirst({
        where: { ruleId: rule.id, serverId: server.id, status: 'OPEN' },
      });
      if (existingOpenAlert) {
        this.logger.debug(
          `Server "${server.name}": anomaly alert already OPEN, skipping duplicate`,
        );
        continue;
      }

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          serverId: server.id,
          details: {
            reconstructionError: score.reconstructionError,
            threshold: score.threshold,
            detectionMethod: 'LSTM-Autoencoder',
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: LSTM anomaly detected on server "${server.name}" (error: ${score.reconstructionError}, threshold: ${score.threshold})`,
      );
    }
  }

  private async evaluateEventRule(rule: {
    id: string;
    organizationId: string;
    eventType: string | null;
    groupByField: string | null;
    maxCount: number | null;
    windowSeconds: number | null;
    severity: string;
  }) {
    if (
      !rule.eventType ||
      !rule.groupByField ||
      !rule.maxCount ||
      !rule.windowSeconds
    )
      return;

    const windowStart = new Date(Date.now() - rule.windowSeconds * 1000);

    const recentEvents = await this.prisma.event.findMany({
      where: {
        eventType: rule.eventType,
        createdAt: { gte: windowStart },
        OR: [{ organizationId: rule.organizationId }, { organizationId: null }],
      },
    });

    const groups = new Map<string, typeof recentEvents>();
    for (const event of recentEvents) {
      const metadata = event.metadata as Record<string, unknown>;
      const groupValue = metadata[rule.groupByField] as string | undefined;
      if (!groupValue) continue;

      if (!groups.has(groupValue)) groups.set(groupValue, []);
      groups.get(groupValue)!.push(event);
    }

    this.logger.debug(
      `Rule "${rule.id}": ${groups.size} distinct "${rule.groupByField}" group(s) found`,
    );

    for (const [groupValue, events] of groups.entries()) {
      if (events.length < rule.maxCount) continue;

      const existingOpenAlert = await this.prisma.alert.findFirst({
        where: {
          ruleId: rule.id,
          status: 'OPEN',
          details: { path: ['groupValue'], equals: groupValue },
        },
      });
      if (existingOpenAlert) {
        this.logger.debug(
          `Group "${groupValue}": alert already OPEN, skipping duplicate`,
        );
        continue;
      }

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          details: {
            groupValue,
            count: events.length,
            groupByField: rule.groupByField,
            eventType: rule.eventType,
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: ${events.length} "${rule.eventType}" events from ${rule.groupByField}="${groupValue}" (rule "${rule.id}")`,
      );
    }
  }
}
