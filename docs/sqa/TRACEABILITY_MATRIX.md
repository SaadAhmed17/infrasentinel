# Requirements traceability matrix

Chain: **Requirement → Test IDs → Automated test location → Result → Defect → Evidence**.

Requirements are taken from the README's feature claims (quoted) where they exist, and
otherwise from the behaviour the code and UI clearly intend (marked *implied*).
Test IDs are embedded in test names, so any row can be found with a text search.
Results are for **`team-dev` on 2026-10-06**; defects marked "fixed" were open in cycle 1.
Result: ✅ all pass · ⚠️ passes except known defects · ❌ requirement not met · n/a not on `team-dev`.

| Req | Requirement | Test IDs | Location | Result | Defects |
|---|---|---|---|---|---|
| **Multi-tenancy** | | | | | |
| REQ-T1 | "Multi-tenant architecture": list endpoints return only the caller's organization's data | TENANT-001, 002 | `apps/api/test/tenant-isolation.int-spec.ts` | ✅ | — |
| REQ-T2 | Another org's records cannot be read, changed or deleted by ID | TENANT-010..019, 026 | same | ✅ | DEF-08, DEF-22 fixed |
| REQ-T3 | "organizationId … never trusted from client input" | TENANT-020..025 | same | ✅ | DEF-04 fixed |
| REQ-T4 | Agent keys bind data to exactly one server/org | TENANT-030, 031, METRIC-021 | tenant + ingestion specs | ✅ | — |
| REQ-T5 | SIEM rules and correlation never mix tenants | SIEM-010, 034, 035, INC-003, REG-022, REG-036 | `siem-detection.int-spec.ts`, `siem-regressions.int-spec.ts` | ✅ | DEF-05 fixed |
| REQ-T6 | "one tenant's incidents are never retrievable by another" (RAG) | RAG-I01..05, RAG-U01, TENANT-024 | `apps/ai-service/tests/test_rag_pgvector.py`, `test_rag.py` | ✅ | — |
| **Authentication** | | | | | |
| REQ-A1 | "Custom JWT + refresh tokens": signup creates an OWNER in a new org | AUTH-001..003 | `auth.int-spec.ts` | ✅ | — |
| REQ-A2 | Login issues tokens; failures reveal nothing about account existence | AUTH-010..012, auth.service.spec | auth specs | ✅ | — |
| REQ-A3 | Only valid, correctly signed, unexpired access tokens are accepted | AUTH-020, 021 (6 attacks), RBAC-002 | auth + rbac specs | ✅ | — |
| REQ-A4 | Refresh tokens renew sessions safely | AUTH-030..035, PWR-008 | `auth.int-spec.ts`, `password-reset.int-spec.ts` | ⚠️ | DEF-12 (partly fixed) |
| REQ-A5 | Brute-force resistance (*implied* for a security product) | AUTH-013 | `auth.int-spec.ts` | ❌ | DEF-13 |
| REQ-A6 | Invitations are single-use and expire | AUTH-040..044 | same | ⚠️ | DEF-23 |
| REQ-A7 | Password hashes are never exposed | AUTH-050, AUTH-001 | same | ✅ | — |
| REQ-A8 | Forgotten passwords can be reset by e-mail without revealing which accounts exist (requested by the team lead) | PWR-001..011, forgot-password.spec | `password-reset.int-spec.ts`, `apps/api/src/auth/forgot-password.spec.ts` | ✅ | DEF-52 fixed |
| **Authorization** | | | | | |
| REQ-R1 | "6-role RBAC via Guards": each endpoint enforces the role matrix | RBAC-001 (120 cases), RBAC-002 | `rbac.int-spec.ts`, [RBAC_MATRIX.md](RBAC_MATRIX.md) | ✅ 121/121 | — |
| REQ-R2 | Every non-public endpoint is authenticated; declared roles are enforced | policy scan (5 checks) | `apps/api/src/authorization-policy.spec.ts` | ✅ | — |
| REQ-R3 | "full member/role management": role hierarchy cannot be bypassed (*implied* by UI hiding OWNER changes) | RBAC-010..021 | `rbac.int-spec.ts` | ✅ | DEF-03, DEF-20 fixed |
| **Ingestion** | | | | | |
| REQ-I1 | "Python agent … pushing metrics via API key" | AGENT-001..005, AGENT-MET-010..013 | ingestion spec, `apps/agent/tests` | ✅ | DEF-21 fixed |
| REQ-I2 | Telemetry is validated (ranges, types) and nothing invalid is stored | METRIC-001 (15 BVA), 010..013 | `agent-ingestion.int-spec.ts` | ✅ | — |
| REQ-I3 | Agents cannot back-date data or re-attribute it | METRIC-020, 021 | same | ✅ | — |
| REQ-I4 | "real SSH auth-log events, real sudo-command events" | AGENT-SSH-001..032, EVENT-001..003, REG-070 | `apps/agent/tests/test_ssh_log_agent.py`, ingestion + regression specs | ⚠️ | DEF-19 fixed, DEF-29 (partly fixed) |
| REQ-I5 | Agent metric calculations are correct and API-compatible | AGENT-MET-001..005 | `apps/agent/tests/test_metrics_agent.py` | ⚠️ | DEF-35 |
| REQ-I6 | Agent secrets not exposed to dashboard users (*implied*) | AGENT-010, 011, 013, 014 | ingestion spec | ✅ | DEF-07 fixed |
| **SIEM detection** — "Confirmed real-data attack detections" | | | | | |
| REQ-S1 | Metric-threshold rules fire on sustained breach, exact boundaries, no duplicates | SIEM-001..011, REG-001, 002 | `siem-detection.int-spec.ts`, `siem-regressions.int-spec.ts` | ✅ | DEF-15 fixed |
| REQ-S2 | "service crash" (heartbeat missing) | SIEM-020..022 | `siem-detection.int-spec.ts` | ✅ | — |
| REQ-S3 | "SSH brute-force, web login brute-force" (event frequency) | SIEM-030..035, REG-020..022 | siem specs | ✅ | DEF-05, DEF-48 fixed |
| REQ-S4 | "credential stuffing" | SIEM-040..044 | `siem-detection.int-spec.ts` | ✅ | DEF-16 fixed |
| REQ-S5 | "unauthorized root access" (unusual access) | SIEM-050..056, REG-054, 055, 070 | siem specs | ✅ | DEF-09 fixed |
| REQ-S6 | "API abuse" (API request logging) | LOG-001..004 | `agent-ingestion.int-spec.ts`, `api-usage.middleware.spec.ts` | ✅ | DEF-10, DEF-34 fixed |
| REQ-S7 | Detections keep working after an incident is handled, without re-reporting old evidence (*implied*) | SIEM-012, INC-012, REG-010, 011 | siem specs | ✅ | DEF-06, DEF-47 fixed |
| REQ-S8 | "LSTM … auto-alerting integrated into the SIEM pipeline" | SIEM-060..062 | `siem-detection.int-spec.ts` | ✅ | — |
| REQ-S9 | A rule that could never fire is rejected, not shown as Active (*implied*) | REG-050..055 | `siem-regressions.int-spec.ts` | ✅ | DEF-50 fixed |
| REQ-S10 | Deleting a rule keeps its alert and incident history (team lead decision) | REG-060 | same | ✅ | DEF-53 fixed |
| **Incidents** | | | | | |
| REQ-C1 | Alerts are correlated into incidents per server, highest severity, idempotently | INC-001..004 | `siem-detection.int-spec.ts` | ✅ | — |
| REQ-C2 | Related alerts within a short window join one incident; unrelated ones do not (code comment) | INC-007, REG-030..036 | siem specs | ✅ | DEF-17, DEF-51 fixed |
| REQ-C3 | Incident status workflow | INC-010..014 | `siem-detection.int-spec.ts` | ✅ | DEF-06, DEF-20 fixed |
| REQ-C4 | "automatic incident indexing" for RAG | — (INC-005, 006 removed) | — | n/a | DEF-18 n/a: `team-dev` indexes only through `POST /rag/reindex` |
| **Anomaly detection** | | | | | |
| REQ-M1 | "drops nulls, log-transforms skewed features, … sliding-window sequences (20 timesteps)" | ML-PRE-001..004 | `apps/ai-service/tests/test_preprocess.py` | ✅ | — |
| REQ-M2 | Chronological split; scaler fitted on training data only (no leakage) | ML-PRE-005..007 | same | ✅ | — |
| REQ-M3 | "threshold from the 95th percentile of validation reconstruction error" | ML-TRN-001, 002 | `test_training_inference.py` | ✅ for the code | DEF-54: the team's trained model files use another threshold |
| REQ-M4 | Real-time inference: correct scoring, strict threshold, clear errors | ML-INF-001..007, AI-API-003 | same, `test_api.py` | ✅ | — |
| REQ-M5 | Detector quality is acceptable (Q6: F1 ≥ 0.85, FPR ≤ 5%) | evaluation harness | `apps/ai-service/evaluation/` → [evidence](evidence/ML_EVALUATION_RESULTS.md) | ✅ F1 0.914, FPR 0.037 | — |
| REQ-M6 | Training/inference robust to operational conditions | ML-TRN-003, 004, ML-PRE-008..011 | ML tests | ✅ | DEF-28, DEF-37, DEF-43 fixed |
| REQ-M7 | Early stopping keeps the best model, not the last one (*implied*) | ML-TRN-005 | `test_training_inference.py` | ✅ | DEF-46 fixed |
| **RAG assistant** | | | | | |
| REQ-G1 | Answers grounded only in retrieved incidents; honest "no data" answer | RAG-U02, U03, U06, RAG-I03 | `test_rag.py`, `test_rag_pgvector.py` | ✅ | — |
| REQ-G2 | "hybrid semantic + recency search" without duplicates | RAG-U04 | `test_rag.py` | ✅ | — |
| REQ-G3 | Graceful degradation when the LLM is unavailable (*implied*) | RAG-U07, rag.service.spec | same, `apps/api/src/rag/rag.service.spec.ts` | ❌ | DEF-27 |
| REQ-G4 | Resistance to prompt injection via stored data (*implied*) | RAG-U08 | `test_rag.py` | ❌ | DEF-25 |
| REQ-G5 | AI service reachable only by the API (*implied*) | AI-API-004, SEC-AI-001..003 | `test_api.py` | ✅ | DEF-24 fixed |
| **Reliability / process** | | | | | |
| REQ-P1 | AI-service failures degrade gracefully | SIEM-062, anomaly/rag service specs | unit specs | ⚠️ | DEF-26 |
| REQ-P2 | Monitoring reflects real server state | MON-001..004 | ingestion spec | ✅ | DEF-14 fixed |
| REQ-P3 | All tests run automatically on every change | CI workflow | `.github/workflows/ci.yml` | ✅ (first run on push) | DEF-32 fixed |
| REQ-P4 | One failing rule or a slow tick never stops or duplicates detection (*implied*) | REG-040, 041 | `siem-regressions.int-spec.ts` | ✅ | DEF-49 fixed |
