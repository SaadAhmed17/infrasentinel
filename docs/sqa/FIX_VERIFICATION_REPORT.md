# Fix verification report — `team-dev`

| | |
|---|---|
| Date | 2026-10-06 |
| Branch | `team-dev` |
| Approach | one commit per fix; each fix is proven by its known-defect test now passing as a normal regression test, or by a new regression test written for it; every suite was then run on the final commit |
| History | cycle 1 (2026-09-30) prepared fixes on local branches against `develop`. On 2026-10-02 the team lead chose which fixes `team-dev` gets; they were re-applied as clean commits, adapted to the `team-dev` code. The SIEM fixes, forgot password, the ports from `develop` and the test suite were approved later, one by one |

## Fixes and features

Batch 1 — the team lead's list of 2026-10-02, plus forgot password:

| Commit | Defects | What changed | Proof (tests that now pass) |
|---|---|---|---|
| `a37d689` | DEF-06 High, DEF-20 (status), DEF-22 (incidents) | resolving an incident resolves its alerts (one transaction); status body validated; another org's incident → 404 | SIEM-012, INC-011, INC-012 (+ INC-013, INC-014) |
| `2c6c4a8` | DEF-07 High, DEF-21 | agent API key returned only on create/regenerate; `POST /servers/:id/regenerate-key`; invalid key → 401 | AGENT-005, AGENT-010, AGENT-011 (+ AGENT-013, AGENT-014) |
| `46a6a49` | DEF-03 High, DEF-20 (role) | only an OWNER may grant or change OWNER (checked against the database, not the token); OWNER invitations need an OWNER; ≥ 1 owner kept; role DTO | RBAC-011..016 (+ RBAC-017..021) |
| `60d0fcd` | DEF-43 High, DEF-28, DEF-37 | features a server never reports filled with a constant; per-server error isolation; clear "not enough history" error; absolute artifact path; inference reuses training's cleaning | ML-PRE-008, 009, ML-TRN-003 (+ ML-PRE-010, 011, ML-TRN-004, ML-INF-007) |
| `87f23ce` | DEF-14 | 30 s sweep marks servers OFFLINE after 60 s of silence (`SERVER_OFFLINE_AFTER_SECONDS`) | MON-001 (+ MON-002..004) |
| `0aca0b2` | DEF-11 | 401s from `/auth/*` shown as errors instead of reloading the page; non-JSON error bodies handled | code review (no frontend test runner) |
| `0f39830` | DEF-08, DEF-24 | anomaly-score ownership check; the AI service refuses every call without the shared secret except `/health`, and refuses everything if no secret is configured | TENANT-018 (+ TENANT-026), AI-API-004 |
| `d6a9232` | feature | forgot password / reset password: same answer for every e-mail, link valid 30 min and usable once, one e-mail per address per minute, older sessions can no longer refresh, security events recorded | PWR-001..011 |

Batch 2 — SIEM fixes, ports from `develop` and the test suite, approved afterwards:

| Commit | Defects | What changed | Proof |
|---|---|---|---|
| `d66c3e4` | DEF-52 | without SMTP, forgot password says so (503, same for every e-mail); SMTP login checked and logged at startup | `forgot-password.spec` (6 tests) |
| `94e71d2` | DEF-24 (follow-up) | same secret name and header as `main` (`AI_SERVICE_SHARED_SECRET`, `x-internal-secret`), so one `.env` works on both branches | SEC-AI-001..003, anomaly/rag unit specs |
| `1610b94` | DEF-04 High | rule updates validated by `UpdateRuleDto`; unknown fields such as `organizationId` stripped | TENANT-021 (+ TENANT-025) |
| `fa60ab3` | DEF-22 (rules) | another org's rule toggle → 404; `isActive` must be a boolean | TENANT-019, REG-053 |
| `d1b2fed` | DEF-50 | a rule must have what its type needs; event type and group-by field from fixed lists; name not empty; duration ≥ 1 | REG-050..053 |
| `75a78ca` | DEF-05 High | event rules count only their own organization's events | SIEM-035 |
| `55a66cb` | DEF-19 | agents may only send SSH event types | EVENT-003 |
| `3c94f53` | DEF-16 | credential stuffing evaluated in time order | SIEM-044 |
| `22c2a4c` | DEF-47 | each event alert remembers its newest event (`lastEventAt`); already-reported events never alert again | REG-010, REG-011 |
| `08e072f` | DEF-15 | breaching readings must cover the whole duration (first reading may be up to 15 s late) | SIEM-011, REG-001, REG-002 |
| `79277f5` | DEF-48 | an event alert is linked to the server when all its events come from one server of the same org | REG-020..022 |
| `e465f9e` | DEF-17, DEF-51 | alerts grouped by what they are about (server, else IP/user/account, else rule); a new alert joins an unresolved incident about the same thing from the last 5 minutes; resolved incidents never reopen | INC-007, REG-030..036 |
| `e0ebe12` | DEF-49 | every rule evaluated on its own (one failure is logged and skipped); ticks and correlation runs never overlap | REG-040, REG-041 |
| `4631bcb` | DEF-04 / DEF-50 follow-up | a partial update (e.g. rename) merges only the fields that were sent | TENANT-020, REG-052 |
| `47083ac` | DEF-42 | rule and incident controls shown only to OWNER, ADMIN, SECURITY_ANALYST; failed actions show their error; event type and group-by are dropdowns | code review, web build |
| `8a85037` | — | wording of the incomplete-rule error ("EVENT_FREQUENCY rules need: …") | REG-050 |
| `ec2a283` | — | the two web lint errors that stopped the new `team-dev` CI job | web lint |
| `ca2d306` | DEF-46 | training saves a real copy of the best epoch | ML-TRN-005 |
| `aaa41f6` | DEF-53 | deleting a rule hides it (`deletedAt`) and switches it off; its alerts and incidents stay. **Migration** `20261006090000_add_rule_deleted_at` | REG-060 |
| `95d07f5` | DEF-09, DEF-29 (part) | UNUSUAL_ACCESS (sudo) rule ported from `develop` with validated settings, own-org events only, each sudo event reported once, alert linked to the server; the agent reports sudo use and refused attempts as FAILURE. **Migration** `20260905145114_add_unusual_access_rule_type` (identical to `develop` and `main`) | SIEM-050..056, REG-054, 055, 070, AGENT-SSH-020 |
| `a0a6e7f` | DEF-10, DEF-34 | API request logging ported from `develop` with the real request path; agent, health and dashboard-polling routes not counted; "API Flood" preset | LOG-001..004, `api-usage.middleware.spec` |
| `010648a` | — | `main.ts` and the tests share one HTTP setup (CORS, validation) | whole integration suite |
| `b8ed038` | — | startup fix for `a0a6e7f` (the logging middleware needs the JWT module); found by the integration harness before anything was pushed | API boots; whole integration suite |
| `6c27fd8` | DEF-30, DEF-36 | API test harness and unit tests | 50 unit tests |
| `75447cf` | — | API integration tests against a real database | 342 tests |
| `3c0351a` | — | AI service tests (ML pipeline, RAG, API, shared secret) | 78 tests |
| `086e77c` | — | monitoring agent tests | 31 tests |
| `45ea3b9` | DEF-32 | CI runs every suite (CI for `team-dev` itself was added by `d748e40`) | first GitHub run happens on push |

## Results on the final code (`45ea3b9`, 2026-10-06)

| Check | Result |
|---|---|
| API lint, type-check, build | ✅ |
| Web lint, type-check, production build | ✅ (1 pre-existing lint warning) |
| ruff (AI service, agent tests) | ✅ |
| API unit tests | ✅ 50 / 50 (2 of them known defects: DEF-26, DEF-27) |
| API integration tests | ✅ 342 / 342 (4 of them known defects: DEF-12 ×2, DEF-13, DEF-23) |
| AI service tests | ✅ 76 passed, 2 known defects (DEF-25, DEF-27) |
| Agent tests | ✅ 28 passed, 3 known defects (DEF-29 ×2, DEF-35) |
| ML evaluation harness | same results as cycle 1 (F1 0.914, FPR 0.037) — see [ML_VALIDATION.md](ML_VALIDATION.md) |
| GitHub Actions | not run yet — runs when `team-dev` is pushed |

Full numbers: [TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md).

## Notes for the team

- **Database**: two new migrations. Run `pnpm --filter api exec prisma migrate deploy`
  against the team database after pulling. The unusual-access migration is byte-identical
  to the one on `develop` and `main`, so databases already migrated from those branches
  only need the `deletedAt` column.
- **Configuration**: `AI_SERVICE_SHARED_SECRET` must have the same value in
  `apps/api/.env` and `apps/ai-service/.env`; without it the AI service refuses all
  calls except `/health`. Forgot password needs the `SMTP_*` settings (see `.env.example`).
- **Decisions taken by the team lead**: alerts do not close automatically when the
  condition clears (they close when their incident is resolved); a deleted rule keeps
  its alert history.
- **`main` vs `team-dev`**: `main` has its own versions of DEF-03, DEF-06, DEF-07 and
  DEF-08, a 120 s OFFLINE timeout (here 60 s), change-password and incident tabs. How to
  merge the two branches is still to be decided.

## Still open

| Defect | Why not fixed yet |
|---|---|
| DEF-01 Critical, DEF-02 | secret rotation must be done by the owner of the database and the live `.env` files |
| DEF-38 Critical, DEF-39, DEF-40, DEF-31 | dependency changes — not approved for `team-dev` yet |
| DEF-12 (rest), DEF-13 | refresh-token rotation and login throttling need a small design decision |
| DEF-25, DEF-26, DEF-27 | AI-service timeouts and RAG/LLM hardening — on hold |
| DEF-54 | the team must choose the anomaly threshold rule before retraining |
| DEF-23, DEF-29 (rest), DEF-33, DEF-35, DEF-44, DEF-45 | smaller items, next batch |
