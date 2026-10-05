# System test report — `main` @ `ca86cfa`

| | |
|---|---|
| Date | 2026-09-30 |
| System under test | `main` @ `ca86cfa` (clean worktree; code identical to `develop` @ `c1f7b6a`) |
| Stack | PostgreSQL 18 + pgvector (PGlite, fresh) · NestJS API :3001 (production build) · Next.js web :3000 (production build) · FastAPI AI service :8000 · real metrics agent on the test laptop (Windows 10) |
| Not available | Groq LLM API key (tests degradation, not answer quality); Linux auth.log (SSH agent not run) |
| Method | scripted exploratory testing through the real UI (Playwright browser) and API, with the API log as the engine's audit trail |
| Tester | Hashim Ahmad (SQA) |

Where each failure stands on `team-dev` today: see the [last section](#status-on-team-dev-2026-10-06).

## Results

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| ST-01 | Whole stack builds and boots from a clean checkout | ✅ Pass | API, web, AI service healthy; migrations applied. Note DEF-45 (config loaded implicitly) |
| ST-02 | Sign up through the UI | ✅ Pass | redirected to dashboard as OWNER |
| ST-03 | Log in with a wrong password | ❌ Fail — **DEF-11** | API 401, then full page reload; email field cleared; **no message shown** |
| ST-04 | Register a server, run the real agent with its key | ✅ Pass | agent pushed every ~12 s; server ONLINE; six live charts render |
| ST-05 | Threshold rule catches a real condition | ✅ Pass | "Disk > 95%" created 18:44:02 → alert 18:44:30 (laptop disk at 99.8%) → incident 18:45:00 |
| ST-06 | Resolve that incident while the breach continues | ❌ Fail — **DEF-06** | incident RESOLVED, its alert still OPEN; no new alert in 100 s; API log: engine skipped the breach on 20 ticks ("alert already OPEN") |
| ST-07 | Create "Unauthorized Root Access" rule from the UI preset | ❌ Fail — **DEF-09**, **DEF-41** | preset click does nothing visible; after opening the form, rule saved as Active but approved users/hours stored as `null` |
| ST-08 | Web brute force (10 wrong logins) | ✅ Pass | alert "11 AUTH_LOGIN_FAILURE events from 127.0.0.1" 18:45:00 → incident 18:46:00 (the earlier UI attempt was correctly counted too) |
| ST-09 | Agent stops (service crash) | ⚠️ Partial — **DEF-14** | heartbeat alert after 57 s ✅; but server list and dashboard still show **ONLINE (online 1, offline 0)** |
| ST-10 | Invite a VIEWER and act as VIEWER | ❌ Fail — **DEF-07**, **DEF-42** | invite + accept ✅; admin action → 403 ✅; but VIEWER receives the agent API key and **forged a metric (201)**; UI shows admin buttons, incident buttons fail silently |
| ST-11 | Ask the AI assistant about incidents | ❌ Fail — **DEF-27** | incidents auto-indexed ✅ (5/5); generation without LLM → HTTP 500, chat shows "Internal server error" |
| ST-12a | Train the LSTM for the (Windows) laptop | ❌ Fail — **DEF-43** | `preprocess.py` crashes: 0 usable rows (39 rows, none with `loadAverage`); aborts training for every server |
| ST-12b | Train and detect on a Linux-like server | ✅ Pass | 320 readings via the real API → model trained (threshold 0.0163); normal error 0.0144 (normal), attack error 301.4 → "LSTM anomaly detected" alert 18:55:00 |
| ST-12c | Correlation of related alerts on one server | ❌ Fail — **DEF-17** | heartbeat + anomaly alerts for the same server became two incidents 60 s apart |

**Summary: 6 pass, 1 partial, 7 fail** (14 scenarios incl. sub-cases). Every failure maps to a
logged defect; 4 new defects were found only by running the full system (DEF-41..45).

## What is UP (works end to end on `main`)

- Account signup/login (correct credentials), JWT sessions, organization creation.
- Server registration, API-key ingestion, real agent telemetry, live dashboards.
- Rule engine for metric thresholds, event frequency (brute force), heartbeat, and LSTM anomaly scores — alerts appear within one 30 s tick, incidents within one 60 s correlation cycle.
- Automatic RAG indexing of new incidents (real MiniLM embeddings into pgvector).
- LSTM training and scoring on servers that report all nine features (Linux).
- Invitations, and server-side role enforcement (VIEWER blocked from admin actions).

## What is DOWN or broken

| Area | Status | Why |
|---|---|---|
| Re-detection after an incident is handled | **Down** | alerts never resolve; the engine suppresses the same problem forever (DEF-06) |
| Unauthorized-root-access detection created from the UI | **Down** | configuration dropped on save (DEF-09) |
| Anomaly detection for Windows servers | **Down** | no model can be trained; one such server blocks training for all (DEF-43) |
| AI assistant answers | **Down without an LLM key** | raw 500 error and no fallback (DEF-27) |
| Server offline status | **Wrong** | dead servers stay ONLINE on dashboard and list (DEF-14) |
| Login error feedback | **Broken** | wrong password → silent reload (DEF-11) |
| Agent key secrecy | **Broken** | any member, incl. VIEWER, can read the key and impersonate the server (DEF-07) |
| Incident grouping | **Degraded** | related alerts split into separate incidents (DEF-17) |

## What needs to be fixed (priority order, with fix direction)

| # | Defect | Fix direction | Effort |
|---|---|---|---|
| 1 | DEF-01, DEF-02 credentials | rotate Neon password and JWT secrets; placeholders in `.env.example` | minutes |
| 2 | DEF-38 Next.js RCE advisories | upgrade `next` to ≥ 16.3.3 | < 1 h |
| 3 | DEF-07 key exposure | `select` without `apiKey` in `getServerMetrics`/`updateServer`; add "regenerate key"; store a hash | 1–2 h |
| 4 | DEF-04 mass assignment | `UpdateRuleDto extends PartialType(CreateRuleDto)` (validated, whitelisted) | < 1 h |
| 5 | DEF-03 role hierarchy | in `updateMemberRole`/`createInvitation`: only OWNER may grant/alter OWNER; keep ≥ 1 OWNER; validate role with a DTO | 1–2 h |
| 6 | DEF-06 alert lifecycle | resolving an incident resolves its alerts; optionally auto-resolve when the condition clears (Grafana/Datadog model) | 2–4 h |
| 7 | DEF-05 cross-tenant events | drop `OR organizationId IS NULL` from tenant rules; handle org-less events in a separate platform-level rule | 1 h |
| 8 | DEF-43 Windows ML | per-server feature set (drop features a server never reports) or impute; wrap each server in try/except in the training loop | 2–3 h |
| 9 | DEF-09 unusual-access config | add the three fields (validated) to `CreateRuleDto` | < 1 h |
| 10 | DEF-14 offline status | scheduled sweep marks servers OFFLINE after N seconds of silence (Wazuh model) | 1 h |
| 11 | DEF-11 login feedback | in `apiFetch`, skip the refresh/redirect logic for `/auth/*` requests | < 1 h |
| 12 | DEF-27 LLM outage | catch provider errors in `query_incidents`; return a friendly message and still list sources | < 1 h |
| 13 | DEF-17, DEF-41, DEF-42, DEF-45 | join open incidents within a window; open form on preset; hide/disable buttons by role; `@nestjs/config` with validation | 0.5–2 h each |

Each fix has a ready-made acceptance test: its known-defect test flips from "expected
failure" to "pass" (see DEFECT_LOG.md for the test IDs).

## Re-test after fixes (cycle 1 combined build)

All cycle-1 fixes combined in one local test build (never published), fresh database,
same stack and agent. Every scenario that failed above was run again:

| ID | Before | After | Evidence |
|---|---|---|---|
| ST-03 | ❌ silent reload | ✅ | "Invalid credentials" shown, email kept, no reload |
| ST-06 | ❌ silent forever | ✅ | resolving set incident + alert RESOLVED; new alert and incident ~6 s later while the disk stayed at 97.7% |
| ST-07 | ❌ config dropped | ✅ | rule saved with approved users "saad, hashim" and hours 9–18 |
| ST-09 | ⚠️ stayed ONLINE | ✅ | both servers OFFLINE; dashboard online 0 / offline 2 |
| ST-10 | ❌ key exposed, metric forged | ✅ | VIEWER response has no apiKey; regenerate-key and role escalation → 403 |
| ST-11 | ❌ HTTP 500 | ✅ | "temporarily unavailable" answer with the relevant incidents as sources |
| ST-12a | ❌ Windows untrainable | ✅ | Windows-like host (no loadAverage) trained on 320 rows and scored; a 26-row server was skipped with a clear message instead of crashing the batch |
| ST-12c | ❌ fragmented | ❌ unchanged | DEF-17 not fixed in this batch |

## Status on `team-dev` (2026-10-06)

The team lead chose which fixes `team-dev` gets; they were applied there as separate
commits ([FIX_VERIFICATION_REPORT.md](FIX_VERIFICATION_REPORT.md)). Every scenario that
failed on `main`:

| ID | Defect | On `team-dev` | Automated proof |
|---|---|---|---|
| ST-03 | DEF-11 | fixed (`0aca0b2`) | code review (no frontend test runner) |
| ST-06 | DEF-06 | fixed (`a37d689`) | SIEM-012, INC-012 |
| ST-07 | DEF-09, DEF-41 | fixed (`95d07f5`, `a0a7424`) | SIEM-055, SIEM-056 |
| ST-09 | DEF-14 | fixed (`87f23ce`) | MON-001..004 |
| ST-10 | DEF-07, DEF-42 | fixed (`2c6c4a8`, `47083ac`) | AGENT-011, AGENT-013, AGENT-014 |
| ST-11 | DEF-27 | **still open** (RAG/LLM changes on hold) | RAG-U07 (known defect) |
| ST-12a | DEF-43 | fixed (`60d0fcd`) | ML-PRE-009..011 |
| ST-12c | DEF-17 | fixed (`e465f9e`) | INC-007, REG-030..036 |

The full system test has not been re-run live on `team-dev` yet; that is the next step
once `team-dev` is pushed and the team database is migrated.

## Limitations of this run

- PGlite is single-process PostgreSQL; the 110 requests/s ingestion figure observed while seeding is not a performance result.
- The SSH/sudo agent needs a Linux `auth.log`; its parsing is covered by unit tests only.
- LLM answer quality could not be assessed without a provider key.
- The browser was driven by Playwright; UI evidence is recorded as page text and API responses rather than screenshots.
