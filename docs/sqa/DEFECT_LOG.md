# Defect log

Cycle 1 baseline: `develop` @ `c1f7b6a` = identical code to `main` @ `ca86cfa`; the system test (SYSTEM_TEST_REPORT.md) ran `main` itself. DEF-01..DEF-45 were found there.
Status column: the state on **`team-dev` on 2026-10-06**, after the fixes the team lead
approved (see [FIX_VERIFICATION_REPORT.md](FIX_VERIFICATION_REPORT.md)). DEF-46..DEF-54 were
found while fixing and testing `team-dev`.

Every product defect still open or partly fixed has an automated known-defect test
(Jest `it.failing` / pytest `xfail(strict=True)`) that encodes the *correct* behaviour,
unless the table says otherwise. See evidence with:

```bash
cd apps/api && SHOW_DEFECTS=1 pnpm test:integration    # prints expected vs received
cd apps/ai-service && pytest --runxfail                 # same for Python
```

When a defect is fixed its test starts passing, CI reports that, and the test is
converted into a normal regression test.

> Security note: this repository is public. Credential details for DEF-01/DEF-02 were
> shared privately with the team lead and are intentionally omitted here.

## Summary (`team-dev`, 2026-10-08)

| Severity | Total | Fixed | Partly fixed | Open | Not applicable |
|---|---|---|---|---|---|
| Critical | 2 | 0 | 0 | 2 (DEF-01, DEF-38) | 0 |
| High | 7 | 6 | 0 | 1 (DEF-02) | 0 |
| Medium | 27 | 20 | 3 (DEF-12, DEF-18, DEF-29) | 4 | 0 |
| Low | 18 | 11 | 0 | 7 | 0 |
| **Total** | **54** | **37** | **3** | **14** | **0** |

"Fixed" = the fix is a commit on `team-dev` and its proof test passes (or, for UI-only
fixes, code review, because the frontend has no test runner yet). "Live" in the evidence
column means the defect was also observed on the running system (`main`, system test ST-xx).

## Defects

| ID | Sev | Area | Title | Evidence (test ID / method) | Status on `team-dev` |
|---|---|---|---|---|---|
| DEF-01 | Critical | Security | A database credential exists in public Git history (removed from the current file, not proven rotated) | history scan (details private) | Open — rotation to be confirmed |
| DEF-02 | High | Security | `apps/api/.env.example` contains real-looking JWT signing secrets; if reused, tokens for any org/role can be forged | static review | Open — still in `.env.example` on `team-dev`; live secrets to be rotated |
| DEF-03 | High | RBAC | Role hierarchy not enforced: an ADMIN can promote anyone (incl. self) to OWNER, demote the OWNER and issue OWNER invitations; the last OWNER can demote themselves. The UI hides this; the API allows it | RBAC-011..015 | **Fixed** `46a6a49` — RBAC-011..016 pass |
| DEF-04 | High | Tenant isolation | Mass assignment: `PATCH /rules/:id` accepts any field (`Partial<CreateRuleDto>` is not validated), so `organizationId` can move a rule into another tenant | TENANT-021 | **Fixed** `1610b94`, `4631bcb` — TENANT-020, 021, 025 pass |
| DEF-05 | High | Tenant isolation / SIEM | Event-based rules also count events with no organization (`OR organizationId IS NULL`): one set of such events raises alerts in **every** tenant and puts another tenant's IPs/e-mails in alert details | SIEM-035 | **Fixed** `75a78ca` — SIEM-035 passes |
| DEF-06 | High | SIEM | Alerts are never resolved (no code path changes `Alert.status`); de-duplication then suppresses every future alert for that rule/server or IP **forever**. Resolving the incident does not resolve its alerts | SIEM-012, INC-012; **live ST-06** (20 engine ticks suppressed while disk stayed at 99.8%) | **Fixed** `a37d689` — SIEM-012, INC-012..014 pass |
| DEF-07 | High | Security | Agent API key returned to every org member (incl. VIEWER) by `GET /servers/:id/metrics` and `PATCH /servers/:id`; holder can forge that server's telemetry. Keys are stored in plaintext and cannot be rotated. The UI promises the key "won't be shown again" | AGENT-011; **live ST-10** (VIEWER obtained the key and forged a metric → 201) | **Fixed** `2c6c4a8` — key shown only on create/regenerate; AGENT-010, 011, 013, 014 pass. Keys are still stored in plaintext (hardening item) |
| DEF-08 | Medium | Tenant isolation | `GET /servers/:id/anomaly-score` has no ownership check (IDOR); mitigated only by UUIDs being hard to guess | TENANT-018 | **Fixed** `0f39830` — TENANT-018, 026 pass |
| DEF-09 | Medium | SIEM | UNUSUAL_ACCESS rules created through `POST /rules` lose their configuration (DTO whitelist strips `approvedUsernames`, business hours) and can never fire, while the UI shows the rule as Active | SIEM-055; **live ST-07** | **Fixed** `95d07f5` (rule ported from `develop` with validated fields) — SIEM-055, 056, REG-054, 055 pass |
| DEF-10 | Medium | SIEM | Every agent metric push is also logged as an organization-less `API_REQUEST` event: extra DB write per metric, and feeds DEF-05 / false API-abuse alerts | LOG-004 | **Fixed** `a0a6e7f` — LOG-004 passes |
| DEF-11 | Medium | Frontend | A wrong password gives **no feedback**: the page hard-reloads, the form is cleared and no message is shown, because `apiFetch` treats every 401 — including the login response — as an expired session (`api-client.ts:43`); same for an invalid invitation | code review; **live ST-03** | **Fixed** `0aca0b2` — code review |
| DEF-12 | Medium | Auth | Refresh tokens are not rotated or revocable (replay works; logout is client-only); a demoted user keeps old privileges until the access token expires | AUTH-034, AUTH-035 | **Partly fixed** `d6a9232`: after a password reset, older sessions can no longer refresh (PWR-008). Rotation and revocation still open (AUTH-034, 035) |
| DEF-13 | Medium | Auth | No throttling or lockout on `/auth/login` (20 wrong guesses → 20 × 401, never 429) | AUTH-013 | Open |
| DEF-14 | Medium | Monitoring | Nothing marks a server OFFLINE; a silent server is counted as online forever — shown ONLINE while a "Service Crash" alert exists for it | MON-001; **live ST-09** | **Fixed** `87f23ce` — MON-001..004 pass |
| DEF-15 | Medium | SIEM | Metric-threshold "duration" is not enforced when data covers less than the window: one 5-second breach fires a 60-second rule (false-positive risk; cf. Prometheus `for:` semantics). The rule form labels the field "Sustained for (seconds)" | SIEM-011 | **Fixed** `08e072f` — SIEM-011, REG-001, 002 pass |
| DEF-16 | Medium | SIEM | Credential stuffing is missed (false negative) if any failed attempt follows the compromising success | SIEM-044 | **Fixed** `3c94f53` — SIEM-044 passes |
| DEF-17 | Medium | Incidents | Incident fragmentation: a new alert on the same server does not join the open incident; the code comment promising a 5-minute window is not implemented | INC-007; **live ST-12** (one server, two incidents 60 s apart) | **Fixed** `e465f9e` — INC-007, REG-030..036 pass |
| DEF-18 | Medium | RAG | A new incident is sent for RAG indexing *before* its alerts are linked (race), and is never re-indexed when its status changes → incomplete/stale assistant context | INC-006 | **Partly fixed** `0710358`: automatic indexing (merged from `develop`) now runs after the alerts are linked, and again when alerts join an open incident. Re-indexing on a status change is still missing |
| DEF-19 | Medium | Ingestion | Agents may submit any `eventType` (e.g. `AUTH_LOGIN_SUCCESS`), so a compromised agent can inject platform auth events | EVENT-003 | **Fixed** `55a66cb` — EVENT-003 passes |
| DEF-20 | Low | Validation | Primitive body fields read with `@Body('x')` bypass validation: unknown role or incident status → HTTP 500 instead of 400 | RBAC-016, INC-011 | **Fixed** `46a6a49` (role), `a37d689` (status) — RBAC-016, INC-011 pass |
| DEF-21 | Low | Ingestion | Invalid agent API key returns 404 instead of 401 | AGENT-005 | **Fixed** `2c6c4a8` — AGENT-005 passes |
| DEF-22 | Low | API | Cross-org toggle/status updates answer 200 `{count: 0}` instead of 404 (data is safe) | TENANT-019 | **Fixed** `a37d689` (incidents), `fa60ab3` (rules) — TENANT-019 passes |
| DEF-23 | Low | Auth | Accepting an invitation for an e-mail that registered meanwhile → 500 (unhandled unique constraint) | AUTH-044 | Open |
| DEF-24 | Medium | AI service | The AI service has no authentication and trusts any `organizationId`; isolation depends entirely on it never being network-reachable | AI-API-004; **live** (answered an arbitrary org with no credentials) | **Fixed** `0f39830`, `94e71d2` — shared secret, fail-closed; AI-API-004, SEC-AI-001..003 pass |
| DEF-25 | Medium | RAG | Indirect prompt injection: attacker-controlled text (e.g. a sudo command line) reaches the LLM prompt with no delimiting or instruction to ignore embedded instructions | RAG-U08 | Open (RAG/LLM changes on hold) |
| DEF-26 | Medium | Reliability | No timeout on AI-service calls; if it hangs, the rule-engine tick waits forever and later detections stall | anomaly.service.spec | Open (not in the approved scope) |
| DEF-27 | Medium | RAG | An LLM provider outage surfaces as an unhandled 500 instead of a graceful message; the chat shows "Internal server error" | RAG-U07, rag.service.spec; **live ST-11** | Open (RAG/LLM changes on hold) |
| DEF-28 | Low | ML | Training with too little history crashes with `TypeError: Expected state_dict to be dict-like` instead of a clear message | ML-TRN-003 | **Fixed** `60d0fcd` — ML-TRN-003 passes |
| DEF-29 | Medium | Agent | SSH agent gaps: failed sudo attempts reported as executed commands; public-key logins/failures not parsed; fixed `/var/log/auth.log` path (absent on RHEL, Debian 12); log rotation not handled | AGENT-SSH-020..022 (first three) | **Partly fixed** `95d07f5`: refused sudo attempts are reported as FAILURE (AGENT-SSH-020). Key-based logins (AGENT-SSH-021, 022), log path and rotation still open |
| DEF-30 | Low | Test code | Two spec files imported `describe` from `node:test`, shadowing Jest's | ran suite | **Fixed** `6c27fd8` |
| DEF-31 | Low | Build | `requirements.txt` files are UTF-16 encoded; many tools expect UTF-8 | static review | Open |
| DEF-32 | Medium | Process | CI ran lint/build only — no tests — and not at all for `team-dev` | CI review | **Fixed** `45ea3b9` (CI for `team-dev` itself was added by `d748e40`); first GitHub run happens on push |
| DEF-33 | Low | Performance | Inference reads a server's **entire** metric history on every score request | code review; **live 2026-10-08**: ~6.3 MB per server per 30-second check, the main source of 41 GB of database network transfer | **Fixed** (2026-10-09): scoring reads only the newest 200 readings (~34 KB, same score); ML-INF-008, ML-PIPE-001 pass |
| DEF-34 | Medium | SIEM | Request-logging middleware records every path as `"/"` on Fastify, so its exclusion list never applies (dashboard polling is logged as potential abuse) | LOG-002, LOG-003 | **Fixed** `a0a6e7f` — LOG-002, 003 pass |
| DEF-35 | Low | Agent | A network-counter reset yields a negative rate; the API rejects the whole payload, losing that heartbeat | AGENT-MET-005 | Open |
| DEF-36 | Low | Test code | Scaffold e2e test was Express-based and required a database; always failed | ran suite | **Fixed** `6c27fd8` |
| DEF-37 | Low | ML | Training writes model artifacts relative to the working directory; inference reads them from the service folder | ML-PRE-008 | **Fixed** `60d0fcd` — ML-PRE-008 passes |
| DEF-38 | Critical | Dependencies | `next@16.2.10` is affected by advisories incl. unauthenticated RCE on Windows-hosted servers (fixed ≥ 16.3.3) | `pnpm audit --prod` | Open — upgrade prepared in cycle 1, not approved for `team-dev` yet |
| DEF-39 | Low | Dependencies | `shadcn` (a code-generator CLI) is a production dependency of `web`, adding 23 advisories to the production tree | `pnpm audit --prod` | Open (dependency change, not approved yet) |
| DEF-40 | Low | Dependencies | `anyio 4.14.1` in the AI service has 3 CVEs (fixed in 4.14.2) | `pip-audit` | Open (dependency change, not approved yet) |
| DEF-41 | Low | Frontend | Rule "Quick preset" buttons fill a hidden form and never open it — clicking one appears to do nothing | **live ST-07**, code review | **Fixed** `a0a7424` (rules page redesign) — code review |
| DEF-42 | Low | Frontend | Add/Edit/Delete/New Rule/Mark resolved are shown to every role (only member management is role-aware); for a VIEWER the incident buttons fail silently (403, no error handling). Server-side RBAC is correct | **live ST-10**, code review | **Fixed** `47083ac` — code review |
| DEF-43 | High | ML | The LSTM can never be trained for a Windows-monitored server: the agent omits `loadAverage` on Windows and pre-processing drops every row with a missing feature (0 rows → crash). The training script has no per-server error handling, so one such server aborts training for **all** servers of all organizations | ML-PRE-009; **live ST-12** (39 rows, 0 with loadAverage) | **Fixed** `60d0fcd` — ML-PRE-009..011, ML-TRN-004 pass |
| DEF-44 | Low | ML | With short histories the percentile threshold is estimated from very few validation windows (13 in the system test), making it unstable | live ST-12 | Open |
| DEF-45 | Low | Configuration | The API has no explicit configuration loading or validation; JWT secrets arrive only because Prisma auto-loads `.env` and happens to be imported before the auth module (whose strategy throws at import if the secret is missing) | live ST-01, code review | Open |
| DEF-46 | Low | ML | `train.py` kept a *reference* to the live weights as the "best" snapshot, so the saved model (and its threshold) came from the last epoch — with early stopping always 5 epochs past the best one | ML-TRN-005 | **Fixed** `ca2d306` — ML-TRN-005 passes |
| DEF-47 | Medium | SIEM | Once resolving an incident resolves its alerts (DEF-06 fix), event rules raised the **same** brute-force / stuffing alert again on the next tick from events that had already been reported | REG-010, REG-011 | **Fixed** `22c2a4c` — REG-010, 011 pass |
| DEF-48 | Medium | SIEM | SSH brute-force alerts were not linked to the server they happened on, so the incident showed no server and could not be grouped per server | REG-020..022 | **Fixed** `79277f5` — REG-020..022 pass |
| DEF-49 | Medium | SIEM | One rule that throws (bad data, a database error) stopped detection for every rule of every organization in that tick — in every tick while the error persisted; a slow tick could overlap the next and raise an ongoing breach twice | REG-040, REG-041 | **Fixed** `e0ebe12` — REG-040, 041 pass |
| DEF-50 | Medium | SIEM | Rules that can never fire were accepted and shown as Active (e.g. an event rule without an event type or count, an unknown event type, a duration of 0) | REG-050..055 | **Fixed** `d1b2fed`, `4631bcb` — REG-050..055 pass |
| DEF-51 | Medium | Incidents | Event alerts without a server were lumped into one incident, even when they were about unrelated IPs or accounts | REG-030, REG-031 | **Fixed** `e465f9e` — REG-030, 031 pass |
| DEF-52 | Medium | Auth | Forgot password answered "check your e-mail" even when no mail server was configured, so no e-mail ever arrived and nothing said why (reported by a team member) | forgot-password.spec | **Fixed** `d66c3e4` — the user is told (503) and the SMTP connection is checked at startup |
| DEF-53 | Medium | SIEM | Deleting a rule also deleted all of its alerts, so its incidents lost their evidence and the security history of what was detected disappeared with the rule | REG-060 | **Fixed** `aaa41f6` — rules are soft-deleted; REG-060 passes |
| DEF-54 | Medium | ML | The thresholds saved with the team's trained models (shared outside Git) are about 1.5 × the 99th percentile of validation error, while `train.py` uses the 95th percentile. Measured: the stored thresholds give almost no false alarms but miss CPU and memory spikes; the code's rule catches most spikes but gives about 144 false alarms per server per day | analysis of the shared model files | **Fixed** (2026-10-08): `train.py` uses the 99th percentile, chosen by measurement (benchmark F1 0.890, FPR 1.2%, meets Q6; about 29 instead of 144 flagged normal windows per server per day on the team's data); ML-TRN-002 passes; InfraServer01–03 retrained with it. See ML_VALIDATION.md |

## Suggested fix order (what is left)

1. DEF-01, DEF-02 (rotate secrets — minutes; placeholders in `.env.example`).
2. DEF-38, DEF-39, DEF-40, DEF-31 — dependency changes, prepared in cycle 1, waiting for approval.
3. DEF-13, DEF-12 (rest) — login throttling and refresh-token rotation (needs a small design decision: limits, token store).
4. DEF-26, DEF-27, DEF-25 — AI-service timeouts and RAG/LLM hardening (on hold).
5. DEF-23, DEF-29 (rest), DEF-35, DEF-44, DEF-45.
