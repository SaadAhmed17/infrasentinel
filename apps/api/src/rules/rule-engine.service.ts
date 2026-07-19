import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(private prisma: PrismaService) {}

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

        const incident = await this.prisma.incident.create({
          data: {
            title: `Incident: ${groupedAlerts.length} related alert(s)`,
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
      };
      const field = fieldMap[rule.metricField];

      const values = recentMetrics.map((m) => m[field] as number);
      this.logger.debug(
        `Server "${server.name}": ${rule.metricField} values in window: [${values.join(', ')}]`,
      );

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
