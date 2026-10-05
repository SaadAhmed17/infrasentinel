# Workflow benchmark: InfraSentinel vs comparable platforms

Purpose (validation, not verification): are we building the *right* workflows? Each
row compares how InfraSentinel handles a core monitoring/SIEM workflow with how
established platforms handle it, and links the gap to our defect log. Platform
behaviour is taken from each vendor's public documentation (sources at the end).

## 1. Alert lifecycle — the biggest gap

| Platform | Alert states | What happens when the condition clears |
|---|---|---|
| Grafana Alerting | Normal → **Pending** → Firing → **Recovering** → Normal (Resolved) | resolves automatically; optional "keep firing for" suppresses flapping |
| Datadog monitors | OK / Warn / Alert / **No Data** | recovery notification; optional re-notify while unresolved |
| Elastic Security | Open / **Acknowledged** / Closed (with close reason: false positive, duplicate, true positive…) | closing a case can close its attached alerts |
| Sentry | Unresolved / Resolved → **Regressed** | a resolved issue reopens automatically if it happens again |
| **InfraSentinel** | **OPEN only** — no acknowledge, no resolve, no recovery | alert stays OPEN forever; de-duplication then blocks every future alert for that rule+server (DEF-06) |

**Consequence**: every comparable platform treats "problem is back" as a new signal
(Sentry calls it a regression). InfraSentinel goes silent. Fix direction: add alert
status transitions (acknowledge/resolve, auto-resolve when the condition clears) and
de-duplicate only against *unresolved* alerts — which the code already does; it just
never resolves anything.

## 2. Sustained-condition rules

| Platform | Mechanism |
|---|---|
| Prometheus | `for:` clause — the condition must hold continuously for the duration before firing |
| Grafana | **pending period** — condition must remain true for the period, else back to Normal |
| **InfraSentinel** | "all readings in the last N seconds breach" — true even with a single 5-second reading (DEF-15) |

Fix direction: require the breach to span the window (earliest breaching reading at
least ~N seconds old), i.e. an explicit Pending state.

## 3. Missing data / agent health

| Platform | Mechanism |
|---|---|
| Wazuh | manager marks an agent **disconnected** when no keep-alive arrives within `agents_disconnection_time` (default 15 min) |
| Datadog | per-monitor **No Data** state, optional `notify_no_data` after `no_data_timeframe` |
| Grafana | dedicated No Data / Error states per rule |
| **InfraSentinel** | server set ONLINE on each metric and **never** set OFFLINE (DEF-14); detecting silence requires the user to create a HEARTBEAT_MISSING rule; a server that never reported is never flagged |

Fix direction: a scheduled sweep that marks servers OFFLINE after a configurable
silence (Wazuh's model), independent of user-created rules.

## 4. Grouping, noise control and maintenance

| Platform | Mechanism |
|---|---|
| Prometheus Alertmanager | **grouping** by labels (`group_by`, `group_wait`, `group_interval`), **inhibition** (a firing alert suppresses dependent ones), **silences** with start/end times for maintenance |
| Elastic | alerts attached to **cases**; bulk status changes |
| **InfraSentinel** | new alerts are batched once a minute per server, never merged into an already-open incident (DEF-17); event alerts without a server are lumped into one group; **no silences / maintenance windows** at all |

Fix direction: correlate new alerts into an open incident for the same server within
a window; add a simple silence/maintenance flag per server or rule.

## 5. Agent credentials

| Platform | Mechanism |
|---|---|
| Datadog | API keys are org-managed; **revoke** and **rotate** (documented zero-downtime rotation with two keys); separate user-scoped application keys with **scopes** |
| Wazuh | per-agent enrollment keys; agents can be removed |
| **InfraSentinel** | one plaintext key per server, shown to every role including VIEWER (DEF-07); no rotation or revocation except deleting the server |

Fix direction: never return the key after creation; add "regenerate key"; store a hash.

## 6. Tenant isolation architecture

| Platform | Mechanism |
|---|---|
| Grafana Mimir / Loki | **every** read and write carries the tenant ID (`X-Scope-OrgID`) and is enforced by the storage layer itself |
| Grafana (docs) | the UI cannot filter data it receives, so the backend must return only the tenant's data |
| **InfraSentinel** | tenant filter written by hand in each query (`where: { organizationId }`) — correct in most places (22/25 checks) but fragile: one missing or wrong filter is a leak (DEF-04, DEF-05, DEF-08); the AI service trusts any `organizationId` it receives (DEF-24) |

Fix direction for the FYP scope: a single helper/middleware that injects the tenant
into every query (e.g. a Prisma client extension), and a service-to-service secret
for the AI service. Longer term: PostgreSQL row-level security.

## 7. Authentication hygiene

Industry baseline (e.g. OWASP ASVS) expects throttling of repeated failed logins and
revocable, rotating refresh tokens. InfraSentinel detects brute force as a SIEM alert
but does not **prevent** it (DEF-13), and refresh tokens are replayable (DEF-12).

## Summary

| Workflow | InfraSentinel vs industry | Defects |
|---|---|---|
| Detection logic (thresholds, windows, frequency, stuffing) | comparable in concept, boundaries verified | DEF-15, DEF-16 |
| Alert lifecycle | **missing** (open-only) | DEF-06 |
| No-data / agent health | **missing** automatic state | DEF-14 |
| Grouping and silences | basic grouping, no silences | DEF-17 |
| Agent credentials | weaker (no rotation, over-exposed) | DEF-07 |
| Tenant isolation | per-query, mostly correct, fragile | DEF-04, DEF-05, DEF-08, DEF-24 |
| Notifications (e-mail/Slack/webhook) | **absent** — dashboard only | product gap (not a defect) |

## Status on `team-dev` (2026-10-06)

The comparison above describes `develop` (cycle 1). On `team-dev`, with the approved fixes:

| Workflow | What changed | Still different from comparable platforms |
|---|---|---|
| Alert lifecycle | resolving an incident resolves its alerts, and the same problem afterwards raises a new alert (DEF-06); already-reported events never alert twice (DEF-47) | no acknowledge state; alerts do not resolve by themselves when the condition clears (team lead's decision) |
| Sustained-condition rules | the breach must cover the whole duration, like Prometheus `for:` (DEF-15) | no visible Pending state |
| No-data / agent health | servers are marked OFFLINE after 60 s of silence (configurable), independent of rules (DEF-14) | a server that never reported stays UNKNOWN and is not alerted on |
| Grouping and silences | a new alert joins the open incident about the same server or subject within 5 minutes; unrelated subjects stay separate (DEF-17, DEF-51) | no silences / maintenance windows |
| Agent credentials | the key is shown only on create/regenerate; regenerating revokes the old key at once (DEF-07) | keys stored in plaintext; no scopes |
| Tenant isolation | DEF-04, DEF-05, DEF-08 fixed; the AI service requires a shared secret (DEF-24) | still a hand-written filter in each query |
| Authentication hygiene | a password reset stops older sessions from refreshing (DEF-12, partly) | no login throttling (DEF-13); refresh tokens still replayable |
| Notifications | e-mail is used for password resets | no alert notifications yet |

## Sources

- Grafana: [Alert rule state and health](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/alert-rule-state-and-health/), [Alert rule evaluation](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/)
- Datadog: [Configure monitors](https://docs.datadoghq.com/monitors/configuration/), [Notifications](https://docs.datadoghq.com/monitors/notify/), [API and application keys](https://docs.datadoghq.com/account_management/api-app-keys/)
- Prometheus: [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/), [Alertmanager configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- Wazuh: [Agent life cycle](https://documentation.wazuh.com/current/user-manual/agent/agent-management/agent-life-cycle.html)
- Elastic: [Manage detection alerts](https://www.elastic.co/docs/solutions/security/detect-and-alert/manage-detection-alerts), [Cases](https://www.elastic.co/docs/solutions/security/investigate/security-cases)
- Sentry: [Issues inbox](https://docs.sentry.io/product/issues/inbox/)
- Grafana Mimir: [Authentication and authorization](https://grafana.com/docs/mimir/latest/manage/secure/authentication-and-authorization/); Loki: [Manage tenant isolation](https://grafana.com/docs/loki/latest/operations/multi-tenancy/)
