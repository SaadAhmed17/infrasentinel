# Security testing report

InfraSentinel is a security product, so its own security is a quality attribute, not
an afterthought. All testing was performed against local, disposable environments
only — never against the team's shared database or any third-party system.

## Method

1. **Threat-driven review** of every controller, guard, DTO and service, plus Git history.
2. **Automated attack tests** in the integration suite (real HTTP pipeline, real database).
3. **Static policy checks** (route-policy scan) and **dependency audits**.
4. Every finding reproduced by a test before being logged ([DEFECT_LOG.md](DEFECT_LOG.md)).

## Coverage against OWASP API Security Top 10 (2023)

| OWASP API risk | What we tested | Cycle 1 result (`develop`) | `team-dev` (2026-10-06) |
|---|---|---|---|
| API1 Broken Object Level Authorization | Org A's OWNER vs every ID-taking endpoint of Org B (read/update/delete) | 8/10 hold · **DEF-08** anomaly-score IDOR · DEF-22 status codes | all hold; DEF-08, DEF-22 fixed |
| API2 Broken Authentication | 6 token attacks (wrong secret, expired, refresh-as-access, tampered payload, `alg:none`, garbage); refresh replay; brute force; invitation reuse/expiry; password reset (PWR-001..011) | forgery all rejected · **DEF-12** replay · **DEF-13** no throttling · DEF-02 secrets | forgery rejected; reset links single-use, expiring, purpose-bound; DEF-12 partly fixed (a reset stops older sessions from refreshing); DEF-13, DEF-02 open |
| API3 Broken Object Property Level Authorization | client-supplied `organizationId` on create/update; API keys in responses | create is safe · **DEF-04** mass assignment on update · **DEF-07** key exposure | DEF-04, DEF-07 fixed; agent keys are still stored in plaintext |
| API4 Unrestricted Resource Consumption | login rate, reset e-mails, RAG reindex by any role, unbounded `limit` | **DEF-13**; reindex flagged as policy question | DEF-13 open; at most one reset e-mail per address per minute (PWR-009); reindex still a policy question |
| API5 Broken Function Level Authorization | every endpoint × 6 roles; anonymous access; route-policy scan | **126/126 pass**, scan passes · **DEF-03** role-hierarchy bypass | **120/120 pass** (20 endpoints on `team-dev`), scan passes; DEF-03 fixed |
| API6 Unrestricted Access to Sensitive Business Flows | invitations granting OWNER; last-owner removal; account recovery | **DEF-03** | DEF-03 fixed; forgot password gives the same answer for every e-mail (PWR-001) and sends the e-mail in the background, so timing should not reveal accounts either (by design, not measured) |
| API7 Server Side Request Forgery | no user-controlled outbound URLs found in the API | not applicable (noted) | not applicable |
| API8 Security Misconfiguration | secrets in repo/history, unauthenticated internal AI service, 500 errors | **DEF-01**, **DEF-02**, **DEF-24**, DEF-20 | DEF-24, DEF-20 fixed; DEF-01, DEF-02 open |
| API9 Improper Inventory Management | route-policy scan discovers every route automatically | all 31 routes inventoried; public list verified | all 32 routes inventoried; public list verified (incl. forgot/reset password) |
| API10 Unsafe Consumption of APIs | LLM/AI-service failures, stored content fed to LLM | **DEF-26**, **DEF-27**, **DEF-25** | still open (RAG/LLM changes on hold) |

## Multi-tenant isolation — how it was proven

- **Two real organizations** in a real PostgreSQL database; the attacker is the *most
  privileged* role (OWNER) of Org A, so passing results hold for every role.
- **Worst-case knowledge**: tests use Org B's real record IDs (as if leaked or guessed).
- **Leak detector**: every response is scanned for any identifier of Org B (org, server,
  API key, rule, alert, incident IDs, e-mails, a unique metric value).
- **Positive controls**: Org A must still see its own data, so an endpoint returning
  *nothing* cannot pass by accident.
- **Beyond the API**: the SIEM engine (SIEM-010/034/035, INC-003, REG-022, REG-036) and
  the RAG store (RAG-I01..05) were tested separately, because isolation must hold in
  background jobs and vector search too — that is where DEF-05 was found (now fixed).

RAG isolation design (RAG-I01): Org B's incident embedding is made *identical* to the
question's embedding, i.e. the single closest vector in the table. Org A still never
retrieves it, and a unique marker from Org B's text never appears in Org A's LLM prompt.

## Input validation

Boundary-value and equivalence-partition tests on telemetry (15 BVA cases, 7 invalid
classes, `Infinity` via `1e309`, invalid JSON) — all rejected with 400 and nothing
stored. Client-sent timestamps and server IDs are ignored. Cycle 1 gaps now fixed on
`team-dev`: fields read with `@Body('x')` skipped validation (DEF-20), agent event types
were not allow-listed (DEF-19), rule updates were not validated (DEF-04). Remaining: an
invitation for an e-mail registered in the meantime gives a 500 (DEF-23). React escapes
output by default and no `dangerouslySetInnerHTML`/`eval` sinks exist in the frontend
(static search); SQL is parameterised throughout (Prisma and psycopg2 `%s` parameters) —
no string-built SQL with user input was found.

## Secrets and configuration

- Git history scan: a database credential was committed and later removed (DEF-01,
  details private); JWT secrets in `.env.example` (DEF-02). Both still need rotation.
- Service-to-service authentication (DEF-24 fix): the API sends a shared secret
  (`AI_SERVICE_SHARED_SECRET`, header `x-internal-secret`) on every AI-service call; the
  AI service compares it in constant time, answers 401 to a wrong or missing secret and
  refuses everything except `/health` when no secret is configured (SEC-AI-001..003).
- Password reset links are signed with a key that includes the current password hash,
  so a link stops working once it has been used; the link is never returned in the HTTP
  response (PWR-011) and the reset page sends no `Referer`.
- Test suites use clearly fake secrets, never reach a real mail server, and refuse to
  run against cloud databases.

## Dependency audit

| Ecosystem | Tool | Cycle 1 (`develop`, 2026-09-30) | `team-dev` (2026-10-06) |
|---|---|---|---|
| Node (production deps) | `pnpm audit --prod` | 71 advisories: 2 critical, 38 high, 29 moderate, 2 low | 96 advisories: 3 critical, 48 high, 40 moderate, 5 low |
| AI service | `pip-audit` | `anyio 4.14.1`: 3 CVEs (fix 4.14.2) — DEF-40 | not re-run; `anyio` is still 4.14.1 |
| Agent | `pip-audit` | no known vulnerabilities | not re-run |

All three critical advisories on `team-dev` are in `next@16.2.10` (unauthenticated RCE,
incl. one specific to Windows-hosted servers; fixed in ≥ 16.3.6) → DEF-38. The other
large sources are `shadcn`, a CLI wrongly in production dependencies (DEF-39), and
`@nestjs/platform-fastify` (`fastify`, `fast-uri`). The count grew because new advisories
were published since cycle 1. The upgrades prepared in cycle 1 (Next 16.3.8, `shadcn` to
devDependencies, NestJS 11.2.7, `anyio` 4.14.2) are waiting for approval; the CI job
`dependency-audit` reports the current state on every push.

## Limitations

- No dynamic scanning of a deployed instance (e.g. OWASP ZAP) — planned once a staging URL exists.
- Timing side channels (login and forgot password, unknown vs known e-mails) are not measured.
- The LLM's susceptibility to injection is inferred from prompt construction, not measured against a live model.
