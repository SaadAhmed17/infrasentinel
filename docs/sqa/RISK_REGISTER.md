# Risk register (risk-based test prioritisation)

Scoring: **Impact** and **Likelihood** from 1 (low) to 5 (high); **Score = I × L**.
Likelihood was estimated *before* testing from code review; "Result" shows what testing
then found. Risks are listed by score — that ordering is the order in which test
effort was spent.

| # | Risk | I | L | Score | Mitigating tests | Result after testing |
|---|---|---|---|---|---|---|
| R1 | Cross-tenant data access or modification via the API (IDOR, mass assignment) | 5 | 4 | **20** | TENANT-001..031 (25 tests) | 22 properties hold; **DEF-04** (mass assignment), **DEF-08** (IDOR) found |
| R2 | Leaked or weak secrets allow token forgery or DB access | 5 | 4 | **20** | history scan, AUTH-021 (forgery cases) | forgery rejected; **DEF-01**, **DEF-02** found |
| R3 | Privilege escalation inside a tenant (role hierarchy, stale privileges) | 5 | 3 | **15** | RBAC-001 (126 cases), RBAC-010..016, AUTH-035 | guard matrix correct; **DEF-03**, **DEF-12** found |
| R4 | Detection silently stops working (false negatives) | 5 | 3 | **15** | SIEM-001..062, INC-001..012 | boundaries correct; **DEF-06**, **DEF-16**, **DEF-09** found |
| R5 | Cross-tenant leakage through the SIEM or RAG pipeline | 5 | 3 | **15** | SIEM-010/034/035, INC-003, RAG-I01..06 | RAG isolation holds; **DEF-05** found in the rule engine |
| R6 | Vulnerable third-party dependencies | 5 | 3 | **15** | dependency audit (pnpm, pip-audit) | **DEF-38** (Next.js RCE advisories), DEF-39, DEF-40 |
| R7 | Forged or malformed telemetry corrupts data or crashes ingestion | 4 | 3 | **12** | METRIC-001..021, EVENT-001..003, AGENT-001..011 | validation solid; **DEF-19**, **DEF-07** found |
| R8 | Authentication weaknesses (brute force, token replay) | 4 | 3 | **12** | AUTH-001..050 | **DEF-12**, **DEF-13** found |
| R9 | Unauthenticated AI service reachable directly | 5 | 2 | **10** | AI-API-004 | **DEF-24** confirmed (no auth) |
| R10 | Alert noise (false positives) causes alert fatigue | 3 | 3 | 9 | SIEM-002/003/005, ML evaluation, LOG-003 | ML FPR 3.7%; **DEF-15**, **DEF-34**, **DEF-10** found |
| R11 | Anomaly model trained or evaluated incorrectly (data leakage, bad threshold) | 3 | 3 | 9 | ML-PRE-001..008, ML-TRN-001..003, ML-INF-001..006, evaluation harness | no leakage; **DEF-28**, **DEF-37** found |
| R12 | AI/LLM dependency failures stall or crash the platform | 3 | 3 | 9 | SIEM-062, AnomalyService/RagService specs, RAG-U07 | **DEF-26**, **DEF-27** found |
| R13 | Prompt injection through stored incident content | 3 | 3 | 9 | RAG-U08 | **DEF-25** confirmed (no mitigation) |
| R14 | Agent misses or misreports security events | 3 | 3 | 9 | AGENT-SSH-001..032 | **DEF-29** found |
| R15 | Monitoring shows wrong server state | 3 | 3 | 9 | MON-001, SIEM-020..022 | **DEF-14** found |
| R16 | Regressions ship because tests do not run automatically | 4 | 5 | **20** | CI pipeline (this branch) | **DEF-32** — fixed once merged |
| R17 | Performance degrades as telemetry grows | 3 | 2 | 6 | planned (PERFORMANCE_TESTING.md) | not yet executed; DEF-33 noted from code |
| R18 | UI shows misleading errors or state | 2 | 3 | 6 | code review (UI in redesign) | **DEF-11** found |

Residual-risk summary: the highest risks (R1–R5) were tested most deeply. Their
*mechanisms* are largely sound (22/25 isolation properties, 126/126 guard cases,
all detection boundaries), and the defects found are specific and fixable.
