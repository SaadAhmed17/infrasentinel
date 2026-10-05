import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnomalyService } from '../anomaly/anomaly.service';
import { Alert, Prisma } from '@prisma/client';

// Agents push a reading about every 10 s (plus a 1 s CPU sample), so a breach
// "sustained for 60 s" may have its first reading up to ~15 s after the window
// start.
const SAMPLE_TOLERANCE_SECONDS = 15;

// Alerts about the same server or attacker within this time of the previous
// one join its open incident instead of opening a new one.
const CORRELATION_WINDOW_MS = 5 * 60 * 1000;

type CorrelatedAlert = Pick<
  Alert,
  'ruleId' | 'serverId' | 'details' | 'createdAt'
>;

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  private evaluating = false;
  private correlating = false;

  constructor(
    private prisma: PrismaService,
    private anomalyService: AnomalyService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async correlateAlertsIntoIncidents() {
    // Two overlapping runs could put the same alerts into two incidents.
    if (this.correlating) return;
    this.correlating = true;
    try {
      await this.correlateNewAlerts();
    } finally {
      this.correlating = false;
    }
  }

  private async correlateNewAlerts() {
    const uncorrelatedAlerts = await this.prisma.alert.findMany({
      where: { status: 'OPEN', incidentId: null },
      include: { rule: true },
      orderBy: { createdAt: 'asc' },
    });

    if (uncorrelatedAlerts.length === 0) return;

    this.logger.debug(
      `Correlation check: ${uncorrelatedAlerts.length} uncorrelated open alert(s)`,
    );

    // Group alerts by organization (never mixed) and by what they are about.
    // Event alerts without a server are grouped by their attacker or target,
    // not lumped together into one "no server" incident.
    const groups = new Map<string, typeof uncorrelatedAlerts>();
    for (const alert of uncorrelatedAlerts) {
      const key = `${alert.rule.organizationId}|${this.correlationKey(alert)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(alert);
    }

    for (const groupedAlerts of groups.values()) {
      const organizationId = groupedAlerts[0].rule.organizationId;
      const alertIds = groupedAlerts.map((a) => a.id);

      // A new alert about the same server / attacker shortly after the last one
      // belongs to the incident that is already open for it.
      const openIncident = await this.findIncidentToJoin(
        organizationId,
        groupedAlerts[0],
      );
      if (openIncident) {
        await this.prisma.alert.updateMany({
          where: { id: { in: alertIds } },
          data: { incidentId: openIncident.id },
        });
        const total = openIncident._count.alerts + groupedAlerts.length;
        const baseTitle = openIncident.title.replace(
          / \+ \d+ more alert\(s\)$/,
          '',
        );
        await this.prisma.incident.update({
          where: { id: openIncident.id },
          data: {
            title: `${baseTitle} + ${total - 1} more alert(s)`,
            severity: this.pickHighestSeverity([
              openIncident.severity,
              ...groupedAlerts.map((a) => a.rule.severity),
            ]),
          },
        });

        this.logger.warn(
          `Incident ${openIncident.id}: added ${groupedAlerts.length} new alert(s)`,
        );
        continue;
      }

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
        where: { id: { in: alertIds } },
        data: { incidentId: incident.id },
      });

      this.logger.warn(
        `Incident created: ${incident.id} grouping ${groupedAlerts.length} alert(s)`,
      );
    }
  }

  // What an alert is about: its server; otherwise (event alerts) the IP, user
  // or account it names; otherwise just the rule that raised it.
  private correlationKey(alert: CorrelatedAlert): string {
    if (alert.serverId) return `server:${alert.serverId}`;
    const subject = this.subjectOf(alert);
    return subject ? `subject:${subject}` : `rule:${alert.ruleId}`;
  }

  private subjectOf(alert: CorrelatedAlert): string | null {
    const details = (alert.details ?? {}) as Record<string, unknown>;
    const subject = details.groupValue ?? details.email;
    return typeof subject === 'string' && subject ? subject : null;
  }

  // An unresolved incident of this organization that already holds an alert
  // about the same thing, raised at most CORRELATION_WINDOW_MS before this one.
  private findIncidentToJoin(organizationId: string, alert: CorrelatedAlert) {
    const subject = this.subjectOf(alert);
    const aboutTheSameThing: Prisma.AlertWhereInput = alert.serverId
      ? { serverId: alert.serverId }
      : subject
        ? {
            serverId: null,
            OR: [
              { details: { path: ['groupValue'], equals: subject } },
              { details: { path: ['email'], equals: subject } },
            ],
          }
        : { serverId: null, ruleId: alert.ruleId };

    return this.prisma.incident.findFirst({
      where: {
        organizationId,
        status: { not: 'RESOLVED' },
        alerts: {
          some: {
            ...aboutTheSameThing,
            createdAt: {
              gte: new Date(alert.createdAt.getTime() - CORRELATION_WINDOW_MS),
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { alerts: true } } },
    });
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
    // A slow tick (e.g. a hanging AI service) must not overlap the next one:
    // both could see "no open alert" for the same problem and raise it twice.
    if (this.evaluating) {
      this.logger.warn(
        'Previous rule-engine tick is still running; skipping this one',
      );
      return;
    }
    this.evaluating = true;
    try {
      await this.evaluateActiveRules();
    } finally {
      this.evaluating = false;
    }
  }

  private async evaluateActiveRules() {
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
      await this.evaluateSafely(rule, () => this.evaluateMetricRule(rule));
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
      await this.evaluateSafely(rule, () => this.evaluateEventRule(rule));
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
      await this.evaluateSafely(rule, () => this.evaluateHeartbeatRule(rule));
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
      await this.evaluateSafely(rule, () =>
        this.evaluateCredentialStuffingRule(rule),
      );
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
      await this.evaluateSafely(rule, () => this.evaluateAnomalyRule(rule));
    }

    const activeUnusualAccessRules = await this.prisma.rule.findMany({
      where: { ruleType: 'UNUSUAL_ACCESS', isActive: true },
    });
    for (const rule of activeUnusualAccessRules) {
      await this.evaluateSafely(rule, () =>
        this.evaluateUnusualAccessRule(rule),
      );
    }
  }

  // Sudo by a user who is not on the approved list, or outside business hours.
  // Each sudo event is reported at most once, even after its incident is resolved.
  private async evaluateUnusualAccessRule(rule: {
    id: string;
    organizationId: string;
    approvedUsernames: string | null;
    businessHourStartUTC: number | null;
    businessHourEndUTC: number | null;
  }) {
    const approved = (rule.approvedUsernames ?? '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    const hasHours =
      rule.businessHourStartUTC !== null && rule.businessHourEndUTC !== null;
    if (approved.length === 0 && !hasHours) return;

    // Look back 5 minutes each tick (the tick runs every 30 s).
    const windowStart = new Date(Date.now() - 5 * 60 * 1000);
    const sudoEvents = await this.prisma.event.findMany({
      where: {
        eventType: 'SUDO_COMMAND',
        createdAt: { gte: windowStart },
        organizationId: rule.organizationId, // tenant's own events only
      },
    });

    for (const event of sudoEvents) {
      const metadata = event.metadata as Record<string, unknown>;
      const username = metadata.username;
      if (typeof username !== 'string') continue;

      const unapprovedUser =
        approved.length > 0 && !approved.includes(username);
      const hour = event.createdAt.getUTCHours();
      const outsideHours =
        hasHours &&
        (hour < rule.businessHourStartUTC! || hour >= rule.businessHourEndUTC!);
      if (!unapprovedUser && !outsideHours) continue;

      const alreadyReported = await this.prisma.alert.findFirst({
        where: {
          ruleId: rule.id,
          details: { path: ['eventId'], equals: event.id },
        },
        select: { id: true },
      });
      if (alreadyReported) continue;

      const reason = unapprovedUser
        ? 'unapproved_user'
        : 'outside_business_hours';
      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          serverId: await this.serverOfEvents([event], rule.organizationId),
          details: {
            eventId: event.id,
            username,
            reason,
            command:
              typeof metadata.command === 'string' ? metadata.command : null,
            outcome:
              typeof metadata.outcome === 'string' ? metadata.outcome : null,
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: unusual sudo access by "${username}" (${reason}) (rule "${rule.id}")`,
      );
    }
  }

  // One failing rule (bad data, a database hiccup) must not stop the others.
  private async evaluateSafely(
    rule: { id: string },
    evaluate: () => Promise<void>,
  ) {
    try {
      await evaluate();
    } catch (err) {
      this.logger.error(
        `Rule "${rule.id}" failed and was skipped this tick: ${err instanceof Error ? err.message : String(err)}`,
      );
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

      // "Sustained for durationSeconds" (like Prometheus `for:`): the breaching
      // readings must cover the whole window, give or take one agent push. A
      // single short spike, or the first reading after a silence, is not enough.
      const observedSeconds =
        (Date.now() - recentMetrics[0].timestamp.getTime()) / 1000;
      if (observedSeconds < rule.durationSeconds - SAMPLE_TOLERANCE_SECONDS) {
        this.logger.debug(
          `Server "${server.name}": breach observed for only ${Math.round(observedSeconds)}s of ${rule.durationSeconds}s, not sustained yet`,
        );
        continue;
      }

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
        // Only this tenant's events. Events with no organization (failed logins
        // for unknown e-mails) cannot be attributed to a tenant, so they must
        // not raise alerts — or leak details — in every organization.
        organizationId: rule.organizationId,
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
      const previous = await this.previousAlertFor(rule.id, 'email', email);
      if (previous.isOpen) continue;

      // Walk the attempts in time order: the account counts as compromised when
      // a success follows failures from at least maxCount distinct IPs. Whatever
      // happens after that success (another failure, say) must not hide it.
      // A success an earlier alert already reported does not count again.
      const distinctIps = new Set<string>();
      let failureCount = 0;
      let compromisingSuccess: (typeof attempts)[number] | undefined;
      for (const attempt of attempts) {
        if (attempt.eventType === 'AUTH_LOGIN_FAILURE') {
          const ip = (attempt.metadata as Record<string, unknown>).ipAddress;
          if (typeof ip === 'string') distinctIps.add(ip);
          failureCount++;
        } else if (
          distinctIps.size >= rule.maxCount &&
          (!previous.reportedUntil ||
            attempt.createdAt > previous.reportedUntil)
        ) {
          compromisingSuccess = attempt;
          break;
        }
      }

      // credential stuffing only matters if they eventually got in
      if (!compromisingSuccess) continue;

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          details: {
            email,
            distinctIpCount: distinctIps.size,
            ipAddresses: Array.from(distinctIps),
            totalFailures: failureCount,
            lastEventAt: compromisingSuccess.createdAt.toISOString(),
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
        organizationId: rule.organizationId, // tenant's own events only
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

      const previous = await this.previousAlertFor(
        rule.id,
        'groupValue',
        groupValue,
      );
      if (previous.isOpen) {
        this.logger.debug(
          `Group "${groupValue}": alert already OPEN, skipping duplicate`,
        );
        continue;
      }

      // Events an earlier (since resolved) alert already reported stay inside
      // the window for a while; only events after them count towards a new one.
      const newEvents = previous.reportedUntil
        ? events.filter((e) => e.createdAt > previous.reportedUntil!)
        : events;
      if (newEvents.length < rule.maxCount) continue;

      const lastEventAt = newEvents.reduce(
        (latest, e) => (e.createdAt > latest ? e.createdAt : latest),
        newEvents[0].createdAt,
      );

      await this.prisma.alert.create({
        data: {
          ruleId: rule.id,
          serverId: await this.serverOfEvents(newEvents, rule.organizationId),
          details: {
            groupValue,
            count: newEvents.length,
            groupByField: rule.groupByField,
            eventType: rule.eventType,
            lastEventAt: lastEventAt.toISOString(),
          },
          status: 'OPEN',
        },
      });

      this.logger.warn(
        `Alert created: ${newEvents.length} "${rule.eventType}" events from ${rule.groupByField}="${groupValue}" (rule "${rule.id}")`,
      );
    }
  }

  // Agent events (e.g. SSH logins) name the server they came from. When all the
  // events behind an alert come from one server of this organization, link the
  // alert to it, so the incident and dashboard show where the attack happened.
  private async serverOfEvents(
    events: { metadata: unknown }[],
    organizationId: string,
  ): Promise<string | null> {
    const serverIds = new Set(
      events
        .map((e) => (e.metadata as Record<string, unknown>).serverId)
        .filter((id): id is string => typeof id === 'string'),
    );
    if (serverIds.size !== 1) return null;

    const [serverId] = serverIds;
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
      select: { id: true },
    });
    return server?.id ?? null;
  }

  // The latest alert this rule raised about the same subject (an IP, an
  // account, ...): whether it is still open, and up to which event time it
  // already reported, so the same events never raise a second alert.
  private async previousAlertFor(
    ruleId: string,
    subjectField: 'groupValue' | 'email',
    subject: string,
  ): Promise<{ isOpen: boolean; reportedUntil: Date | null }> {
    const alert = await this.prisma.alert.findFirst({
      where: { ruleId, details: { path: [subjectField], equals: subject } },
      orderBy: { createdAt: 'desc' },
    });
    if (!alert) return { isOpen: false, reportedUntil: null };

    const { lastEventAt } = alert.details as Record<string, unknown>;
    return {
      isOpen: alert.status === 'OPEN',
      // Alerts raised before lastEventAt was recorded: use when they were raised.
      reportedUntil:
        typeof lastEventAt === 'string'
          ? new Date(lastEventAt)
          : alert.createdAt,
    };
  }
}
