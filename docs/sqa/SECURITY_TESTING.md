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

| OWASP API risk | What we tested | Result |
|---|---|---|
| API1 Broken Object Level Authorization | Org A's OWNER vs every ID-taking endpoint of Org B (read/update/delete) | 8/10 hold · **DEF-08** anomaly-score IDOR · DEF-22 status codes |
| API2 Broken Authentication | 6 token attacks (wrong secret, expired, refresh-as-access, tampered payload, `alg:none`, garbage); refresh replay; brute force; invitation reuse/expiry | forgery all rejected · **DEF-12** replay · **DEF-13** no throttling · DEF-02 secrets |
| API3 Broken Object Property Level Authorization | client-supplied `organizationId` on create/update; API keys in responses | create is safe · **DEF-04** mass assignment on update · **DEF-07** key exposure |
| API4 Unrestricted Resource Consumption | login rate, RAG reindex by any role, unbounded `limit` | **DEF-13**; reindex flagged as policy question |
| API5 Broken Function Level Authorization | 21 endpoints × 6 roles; anonymous access; route-policy scan | **126/126 pass**, scan passes · **DEF-03** role-hierarchy bypass |
| API6 Unrestricted Access to Sensitive Business Flows | invitations granting OWNER; last-owner removal | **DEF-03** |
| API7 Server Side Request Forgery | no user-controlled outbound URLs found in the API | not applicable (noted) |
| API8 Security Misconfiguration | secrets in repo/history, unauthenticated internal AI service, 500 errors | **DEF-01**, **DEF-02**, **DEF-24**, DEF-20 |
| API9 Improper Inventory Management | route-policy scan discovers every route automatically | all 31 routes inventoried; public list verified |
| API10 Unsafe Consumption of APIs | LLM/AI-service failures, stored content fed to LLM | **DEF-26**, **DEF-27**, **DEF-25** |

## Multi-tenant isolation — how it was proven

- **Two real organizations** in a real PostgreSQL database; the attacker is the *most
  privileged* role (OWNER) of Org A, so passing results hold for every role.
- **Worst-case knowledge**: tests use Org B's real record IDs (as if leaked or guessed).
- **Leak detector**: every response is scanned for any identifier of Org B (org, server,
  API key, rule, alert, incident IDs, e-mails, a unique metric value).
- **Positive controls**: Org A must still see its own data, so an endpoint returning
  *nothing* cannot pass by accident.
- **Beyond the API**: the SIEM engine (SIEM-010/034/035, INC-003) and the RAG store
  (RAG-I01..06) were tested separately, because isolation must hold in background
  jobs and vector search too — that is where DEF-05 was found.

RAG isolation design (RAG-I01): Org B's incident embedding is made *identical* to the
question's embedding, i.e. the single closest vector in the table. Org A still never
retrieves it, and a unique marker from Org B's text never appears in Org A's LLM prompt.

## Input validation

Boundary-value and equivalence-partition tests on telemetry (15 BVA cases, 7 invalid
classes, `Infinity` via `1e309`, invalid JSON) — all rejected with 400 and nothing
stored. Client-sent timestamps and server IDs are ignored. Remaining gaps: fields read
with `@Body('x')` skip validation (DEF-20), and agent event types are not allow-listed
(DEF-19). React escapes output by default and no `dangerouslySetInnerHTML`/`eval` sinks
exist in the frontend (static search); SQL is parameterised throughout (Prisma and
psycopg2 `%s` parameters) — no string-built SQL with user input was found.

## Secrets and configuration

- Git history scan: a database credential was committed and later removed (DEF-01,
  details private); JWT secrets in `.env.example` (DEF-02).
- Test suites use clearly fake secrets and refuse to run against cloud databases.

## Dependency audit (2026-09-30)

| Ecosystem | Tool | Result |
|---|---|---|
| Node (production deps) | `pnpm audit --prod` | 71 advisories: 2 critical, 38 high, 29 moderate, 2 low |
| AI service | `pip-audit` | `anyio 4.14.1`: 3 CVEs (fix 4.14.2) — DEF-40 |
| Agent | `pip-audit` | no known vulnerabilities |

Root causes of the Node advisories, by top-level dependency: `next` 22 (incl. both
criticals — unauthenticated RCE, one specific to Windows-hosted servers → DEF-38),
`shadcn` 23 (a CLI wrongly in production dependencies → DEF-39),
`@nestjs/platform-fastify` 17, `@nestjs/core` 7, `@prisma/client` 2.
Two small changes (bump Next.js, move `shadcn` to devDependencies) remove about 45 of 71.

## Limitations

- No dynamic scanning of a deployed instance (e.g. OWASP ZAP) — planned once a staging URL exists.
- Timing side channels (login timing for unknown vs known e-mails) not measured.
- The LLM's susceptibility to injection is inferred from prompt construction, not measured against a live model.
