# Fix verification report

| | |
|---|---|
| Date | 2026-09-30 |
| Base | `sqa/foundation` (the test suite), itself based on `develop` = `main` code |
| Approach | one branch per fix; each fix proven by its known-defect test flipping to a passing regression test; all branches then merged together and re-tested live |

## Fixes

| Branch | Defects | What changed | Proof (tests that flipped) | Live re-test |
|---|---|---|---|---|
| `fix/rule-payload-validation` | DEF-04 High, DEF-09 Medium | validated `UpdateRuleDto` (PartialType) for rule updates; unusual-access fields added to `CreateRuleDto` (hours 0–23) | TENANT-021, SIEM-055 (+ new TENANT-025, SIEM-056) | ST-07 ✅ config saved from the UI |
| `fix/role-hierarchy` | DEF-03 High, DEF-20 (role) | only an OWNER may grant/alter OWNER (checked against the DB, not the token); OWNER invitations need an OWNER; ≥ 1 owner kept; role DTO | RBAC-011..016 (+ RBAC-017..021 positive controls) | VIEWER escalation → 403 ✅ |
| `fix/agent-key-exposure` | DEF-07 High, DEF-21, DEF-20 (name) | `apiKey` never returned except on create/regenerate; `POST /servers/:id/regenerate-key`; invalid key → 401; name DTO | AGENT-011, AGENT-005 (+ AGENT-012..015, RBAC row) | ST-10 ✅ VIEWER sees no key |
| `fix/alert-lifecycle` | DEF-06 High, DEF-20 (status), DEF-22 (incidents) | resolving an incident resolves its alerts (transaction); status DTO; cross-org → 404 | SIEM-012, INC-011, INC-012 (+ INC-013, INC-014) | ST-06 ✅ new alert ~6 s after resolving while the disk stayed full |
| `fix/tenant-scoped-events` | DEF-05 High | event rules count only the tenant's own events | SIEM-035 | — (engine-level) |
| `fix/ml-training-robustness` | DEF-43 High, DEF-28, DEF-37 | never-reported features filled with a constant; per-server error isolation; clear "not enough history" error; absolute artifact path; inference reuses training's cleaning | ML-PRE-008/009, ML-TRN-003 (+ ML-PRE-010/011, ML-TRN-004, ML-INF-007) | ST-12 ✅ Windows-like host trained; short-history server skipped with a clear message |
| `fix/dependency-security` | DEF-38 Critical, DEF-39, DEF-40, DEF-31 | Next 16.3.8, NestJS 11.2.7, shadcn → devDependencies, anyio 4.14.2, urllib3 2.8.0, requirements.txt → UTF-8 | audit: 71 → 22 advisories, critical 2 → 0; pip-audit clean | web + API builds ✅ |
| `chore/env-example-placeholders` | DEF-02 (partly) | placeholders instead of real-looking secrets in `.env.example` files | — | — (rotation still required) |
| `fix/request-logging` | DEF-34, DEF-10 | real request path (`originalUrl`); `/agent/*` not logged as user traffic | LOG-002/003/004 (+ unit tests) | — |
| `fix/server-offline-status` | DEF-14 | 30 s sweep marks servers OFFLINE after 60 s of silence (configurable) | MON-001 (+ MON-002..004) | ST-09 ✅ dashboard "online 0, offline 2" |
| `fix/login-error-feedback` | DEF-11 | 401s from `/auth/*` shown as errors; non-JSON error bodies handled | — (no frontend test runner) | ST-03 ✅ "Invalid credentials", form kept |
| `fix/ai-service-resilience` | DEF-08, DEF-26, DEF-27 | anomaly-score ownership check; timeouts on all AI-service calls; LLM outage → friendly answer + sources; unreachable AI → 503 | TENANT-018, timeout test, RAG-U07 (+ TENANT-026, unit tests) | ST-11 ✅ "temporarily unavailable" + sources |

## Combined build (all branches merged: `sqa/integration-check`)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ |
| API lint, type-check, build | ✅ |
| API unit tests | ✅ 40 / 40 |
| API integration tests | ✅ 312 / 312 |
| Web lint + production build (Next 16.3.8) | ✅ (1 pre-existing lint warning) |
| AI service tests | ✅ 50 passed, 2 known defects left (DEF-24, DEF-25) |
| Agent tests | ✅ 25 passed, 4 known defects left (DEF-29, DEF-35) |
| Live re-test ST-03, 06, 07, 09, 10, 11, 12 | ✅ all pass (previously all failed) |

## Merge notes for reviewers

- **Order does not matter functionally**, but two textual conflicts will appear, depending on order:
  - `pnpm-lock.yaml` between `fix/rule-payload-validation` and `fix/dependency-security` —
    resolve by regenerating the lockfile (`pnpm install`), not by hand.
  - `apps/api/src/servers/servers.service.ts` imports between `fix/agent-key-exposure`
    and `fix/server-offline-status` — keep both import lines.
- `fix/dependency-security` adds `minimumReleaseAgeExclude` entries to
  `pnpm-workspace.yaml` for the new security releases (pnpm's supply-chain age gate).
- `fix/request-logging` changes only the request-logging middleware;
  `fix/login-error-feedback` touches only `apps/web/src/lib/api-client.ts`, which the
  `team-dev` UI redesign does not modify.

## Still open

| Defect | Why not fixed yet |
|---|---|
| DEF-01 Critical, DEF-02 (rest) | secret rotation must be done by the owner of the Neon project / live `.env` files |
| DEF-12, DEF-13 | refresh-token rotation and login throttling need a small design decision (token store, limits) |
| DEF-15, DEF-16, DEF-17, DEF-18 | detection/correlation semantics (sustained duration, stuffing logic, incident grouping, re-indexing) — behaviour changes the team should agree on |
| DEF-19, DEF-23, DEF-22 (rules) | small validation fixes, next batch |
| DEF-24, DEF-25 | AI-service authentication and prompt-injection hardening need a shared-secret/config decision |
| DEF-29, DEF-35 | agent parser and counter-reset improvements |
| DEF-33, DEF-41, DEF-42, DEF-44, DEF-45 | performance, UI (in the `team-dev` redesign's files), ML threshold, config loading |
