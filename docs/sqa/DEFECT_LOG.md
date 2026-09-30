# Defect log

Baseline tested: `develop` @ `c1f7b6a` = identical code to `main` @ `ca86cfa`; the system test (SYSTEM_TEST_REPORT.md) ran `main` itself. Every product defect marked **Reproduced** has an
automated known-defect test (Jest `it.failing` / pytest `xfail(strict=True)`) that encodes
the *correct* behaviour. See evidence with:

```bash
cd apps/api && SHOW_DEFECTS=1 pnpm test:integration    # prints expected vs received
cd apps/ai-service && pytest --runxfail                 # same for Python
```

When a defect is fixed its test starts passing, CI reports that, and the test is
converted into a normal regression test.

> Security note: this repository is public. Credential details for DEF-01/DEF-02 were
> shared privately with the team lead and are intentionally omitted here.

## Summary

| Severity | Total | Fix ready (on `fix/*` branches, verified) | Partly fixed | Fixed on `sqa/foundation` | Still open |
|---|---|---|---|---|---|
| Critical | 2 | 1 (DEF-38) | 0 | 0 | 1 (DEF-01: rotation) |
| High | 7 | 6 | 1 (DEF-02) | 0 | 0 |
| Medium | 19 | 8 | 0 | 1 | 10 |
| Low | 17 | 7 | 1 (DEF-22) | 2 | 7 |
| **Total** | **45** | **22** | **2** | **3** | **18** |

"Fix ready" = implemented on its own branch, its known-defect test flipped to a passing
regression test, all suites green, and re-tested live on the combined build — see
[FIX_VERIFICATION_REPORT.md](FIX_VERIFICATION_REPORT.md). Status becomes "Fixed" once merged.
"Live" in the evidence column means the defect was also observed on the running system (`main`, system test ST-xx).

## Defects

| ID | Sev | Area | Title | Evidence (test ID / method) | Status |
|---|---|---|---|---|---|
| DEF-01 | Critical | Security | A database credential exists in public Git history (removed from the current file, not proven rotated) | history scan (details private) | Open — rotation to be confirmed |
| DEF-02 | High | Security | `apps/api/.env.example` contains real-looking JWT signing secrets; if reused, tokens for any org/role can be forged | static review | **Partly fixed** (`chore/env-example-placeholders`): placeholders; live secrets still to be rotated |
| DEF-03 | High | RBAC | Role hierarchy not enforced: an ADMIN can promote anyone (incl. self) to OWNER, demote the OWNER and issue OWNER invitations; the last OWNER can demote themselves. The UI hides this; the API allows it | RBAC-011..015 | **Fix ready** (`fix/role-hierarchy`), verified |
| DEF-04 | High | Tenant isolation | Mass assignment: `PATCH /rules/:id` accepts any field (`Partial<CreateRuleDto>` is not validated), so `organizationId` can move a rule into another tenant | TENANT-021 | **Fix ready** (`fix/rule-payload-validation`), verified |
| DEF-05 | High | Tenant isolation / SIEM | Event-based rules also count events with no organization (`OR organizationId IS NULL`): one set of such events raises alerts in **every** tenant and puts another tenant's IPs/e-mails in alert details | SIEM-035 | **Fix ready** (`fix/tenant-scoped-events`), verified |
| DEF-06 | High | SIEM | Alerts are never resolved (no code path changes `Alert.status`); de-duplication then suppresses every future alert for that rule/server or IP **forever**. Resolving the incident does not resolve its alerts | SIEM-012, INC-012; **live ST-06** (20 engine ticks suppressed while disk stayed at 99.8%) | **Fix ready** (`fix/alert-lifecycle`), verified |
| DEF-07 | High | Security | Agent API key returned to every org member (incl. VIEWER) by `GET /servers/:id/metrics` and `PATCH /servers/:id`; holder can forge that server's telemetry. Keys are stored in plaintext and cannot be rotated. The UI promises the key "won't be shown again" | AGENT-011; **live ST-10** (VIEWER obtained the key and forged a metric → 201) | **Fix ready** (`fix/agent-key-exposure`), verified |
| DEF-08 | Medium | Tenant isolation | `GET /servers/:id/anomaly-score` has no ownership check (IDOR); mitigated only by UUIDs being hard to guess | TENANT-018 | **Fix ready** (`fix/ai-service-resilience`), verified |
| DEF-09 | Medium | SIEM | UNUSUAL_ACCESS rules created through `POST /rules` lose their configuration (DTO whitelist strips `approvedUsernames`, business hours) and can never fire, while the UI shows the rule as Active | SIEM-055; **live ST-07** | **Fix ready** (`fix/rule-payload-validation`), verified |
| DEF-10 | Medium | SIEM | Every agent metric push is also logged as an organization-less `API_REQUEST` event: extra DB write per metric, and feeds DEF-05 / false API-abuse alerts | LOG-004 | **Fix ready** (`fix/request-logging`), verified |
| DEF-11 | Medium | Frontend | A wrong password gives **no feedback**: the page hard-reloads, the form is cleared and no message is shown, because `apiFetch` treats every 401 — including the login response — as an expired session (`api-client.ts:43`); same for an invalid invitation | code review; **live ST-03** | **Fix ready** (`fix/login-error-feedback`), verified |
| DEF-12 | Medium | Auth | Refresh tokens are not rotated or revocable (replay works; logout is client-only); a demoted user keeps old privileges until the access token expires | AUTH-034, AUTH-035 | Reproduced |
| DEF-13 | Medium | Auth | No throttling or lockout on `/auth/login` (20 wrong guesses → 20 × 401, never 429) | AUTH-013 | Reproduced |
| DEF-14 | Medium | Monitoring | Nothing marks a server OFFLINE; a silent server is counted as online forever — shown ONLINE while a "Service Crash" alert exists for it | MON-001; **live ST-09** | **Fix ready** (`fix/server-offline-status`), verified |
| DEF-15 | Medium | SIEM | Metric-threshold "duration" is not enforced when data covers less than the window: one 5-second breach fires a 60-second rule (false-positive risk; cf. Prometheus `for:` semantics). The rule form labels the field "Sustained for (seconds)" | SIEM-011 | Reproduced |
| DEF-16 | Medium | SIEM | Credential stuffing is missed (false negative) if any failed attempt follows the compromising success | SIEM-044 | Reproduced |
| DEF-17 | Medium | Incidents | Incident fragmentation: a new alert on the same server does not join the open incident; the code comment promising a 5-minute window is not implemented | INC-007; **live ST-12** (one server, two incidents 60 s apart) | Reproduced |
| DEF-18 | Medium | RAG | A new incident is sent for RAG indexing *before* its alerts are linked (race), and is never re-indexed when its status changes → incomplete/stale assistant context | INC-006 | Reproduced |
| DEF-19 | Medium | Ingestion | Agents may submit any `eventType` (e.g. `AUTH_LOGIN_SUCCESS`), so a compromised agent can inject platform auth events | EVENT-003 | Reproduced |
| DEF-20 | Low | Validation | Primitive body fields read with `@Body('x')` bypass validation: unknown role or incident status → HTTP 500 instead of 400 | RBAC-016, INC-011 | **Fix ready** (`fix/role-hierarchy + fix/alert-lifecycle + fix/agent-key-exposure`), verified |
| DEF-21 | Low | Ingestion | Invalid agent API key returns 404 instead of 401 | AGENT-005 | **Fix ready** (`fix/agent-key-exposure`), verified |
| DEF-22 | Low | API | Cross-org toggle/status updates answer 200 `{count: 0}` instead of 404 (data is safe) | TENANT-019 | **Partly fixed** (`fix/alert-lifecycle`): incidents now 404; rule toggle still 200 |
| DEF-23 | Low | Auth | Accepting an invitation for an e-mail that registered meanwhile → 500 (unhandled unique constraint) | AUTH-044 | Reproduced |
| DEF-24 | Medium | AI service | The AI service has no authentication and trusts any `organizationId`; isolation depends entirely on it never being network-reachable | AI-API-004; **live** (answered an arbitrary org with no credentials) | Reproduced |
| DEF-25 | Medium | RAG | Indirect prompt injection: attacker-controlled text (e.g. a sudo command line) reaches the LLM prompt with no delimiting or instruction to ignore embedded instructions | RAG-U08 | Reproduced |
| DEF-26 | Medium | Reliability | No timeout on AI-service calls; if it hangs, the rule-engine tick waits forever and later detections stall | anomaly.service.spec | **Fix ready** (`fix/ai-service-resilience`), verified |
| DEF-27 | Medium | RAG | An LLM provider outage surfaces as an unhandled 500 instead of a graceful message; the chat shows "Internal server error" | RAG-U07; **live ST-11** | **Fix ready** (`fix/ai-service-resilience`), verified |
| DEF-28 | Low | ML | Training with too little history crashes with `TypeError: Expected state_dict to be dict-like` instead of a clear message | ML-TRN-003 | **Fix ready** (`fix/ml-training-robustness`), verified |
| DEF-29 | Medium | Agent | SSH agent gaps: failed sudo attempts reported as executed commands; public-key logins/failures not parsed; fixed `/var/log/auth.log` path (absent on RHEL, Debian 12); log rotation not handled | AGENT-SSH-020..022 (first three) | Reproduced |
| DEF-30 | Low | Test code | Two spec files imported `describe` from `node:test`, shadowing Jest's | ran suite | **Fixed** (`2578ca8`) |
| DEF-31 | Low | Build | `requirements.txt` files are UTF-16 encoded; many tools expect UTF-8 | static review | **Fix ready** (`fix/dependency-security`), verified |
| DEF-32 | Medium | Process | CI ran lint/build only — no tests — and not at all for `team-dev` | CI review | **Fixed** (`3b182d0`, pending merge) |
| DEF-33 | Low | Performance | Inference reads a server's **entire** metric history on every score request | code review | Open — perf test planned |
| DEF-34 | Medium | SIEM | Request-logging middleware records every path as `"/"` on Fastify, so its exclusion list never applies (dashboard polling is logged as potential abuse) | LOG-002, LOG-003 | **Fix ready** (`fix/request-logging`), verified |
| DEF-35 | Low | Agent | A network-counter reset yields a negative rate; the API rejects the whole payload, losing that heartbeat | AGENT-MET-005 | Reproduced |
| DEF-36 | Low | Test code | Scaffold e2e test was Express-based and required a database; always failed | ran suite | **Fixed** (`eb9b9f4`) |
| DEF-37 | Low | ML | Training writes model artifacts relative to the working directory; inference reads them from the service folder | ML-PRE-008 | **Fix ready** (`fix/ml-training-robustness`), verified |
| DEF-38 | Critical | Dependencies | `next@16.2.10` is affected by advisories incl. unauthenticated RCE on Windows-hosted servers (fixed ≥ 16.3.3) | `pnpm audit --prod` | **Fix ready** (`fix/dependency-security`), verified |
| DEF-39 | Low | Dependencies | `shadcn` (a code-generator CLI) is a production dependency of `web`, adding 23 advisories to the production tree | `pnpm audit --prod` | **Fix ready** (`fix/dependency-security`), verified |
| DEF-40 | Low | Dependencies | `anyio 4.14.1` in the AI service has 3 CVEs (fixed in 4.14.2) | `pip-audit` | **Fix ready** (`fix/dependency-security`), verified |
| DEF-41 | Low | Frontend | Rule "Quick preset" buttons fill a hidden form and never open it — clicking one appears to do nothing | **live ST-07**, code review | Open |
| DEF-42 | Low | Frontend | Add/Edit/Delete/New Rule/Mark resolved are shown to every role (only member management is role-aware); for a VIEWER the incident buttons fail silently (403, no error handling). Server-side RBAC is correct | **live ST-10**, code review | Open |
| DEF-43 | High | ML | The LSTM can never be trained for a Windows-monitored server: the agent omits `loadAverage` on Windows and pre-processing drops every row with a missing feature (0 rows → crash). The training script has no per-server error handling, so one such server aborts training for **all** servers of all organizations | ML-PRE-009; **live ST-12** (39 rows, 0 with loadAverage) | **Fix ready** (`fix/ml-training-robustness`), verified |
| DEF-44 | Low | ML | With short histories the 95th-percentile threshold is estimated from very few validation windows (13 in the system test), making it unstable | live ST-12 | Open |
| DEF-45 | Low | Configuration | The API has no explicit configuration loading or validation; JWT secrets arrive only because Prisma auto-loads `.env` and happens to be imported before the auth module (whose strategy throws at import if the secret is missing) | live ST-01, code review | Open |

## Suggested fix order

1. DEF-01, DEF-02 (rotate secrets — minutes), DEF-38 (bump Next.js).
2. DEF-04, DEF-03, DEF-07, DEF-05 (isolation and privilege) — small, local code changes.
3. DEF-06 (add alert resolution) — restores the SIEM's ability to re-detect.
4. DEF-43 (impute or drop unavailable features per server; isolate per-server failures) — restores anomaly detection for Windows hosts.
5. Remaining Medium items, then Low.
