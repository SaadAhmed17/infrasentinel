# InfraSentinel — Software Quality Assurance

SQA owner: Hashim Ahmad. Cycle 1 completed 2026-09-30.

## At a glance

| | Before | After cycle 1 |
|---|---|---|
| Automated tests | 7 (backend only) | **398** (API, agent, ML, RAG) |
| Tests run in CI | 0 | all suites, on every PR (incl. `team-dev`) |
| Backend statement coverage | 17.8% | 94.7% (integration) |
| Real-database testing | none | PostgreSQL + pgvector (PGlite locally, service container in CI) |
| Defects logged | 0 | 40 (2 Critical, 6 High, 19 Medium, 13 Low) |
| ML quality evidence | none | F1 0.914, FPR 3.7%, ROC-AUC 0.958 on a labelled benchmark |

## Documents

| Document | Purpose |
|---|---|
| [SQA_PLAN.md](SQA_PLAN.md) | strategy, scope, objectives, levels, techniques, tools, criteria, defect process, CI gates |
| [RISK_REGISTER.md](RISK_REGISTER.md) | why we tested what we tested (impact × likelihood) |
| [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) | requirement → tests → result → defect |
| [RBAC_MATRIX.md](RBAC_MATRIX.md) | expected access-control policy (tested cell by cell) |
| [DEFECT_LOG.md](DEFECT_LOG.md) | all defects with severity, evidence and status |
| [SECURITY_TESTING.md](SECURITY_TESTING.md) | OWASP API Top-10 coverage, tenant isolation method, dependency audit |
| [ML_VALIDATION.md](ML_VALIDATION.md) | how the LSTM detector is validated; results and limitations |
| [TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md) | cycle-1 results, coverage, stability |
| [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) | performance plan and acceptance criteria (not yet executed) |
| [INDUSTRY_COMPARISON.md](INDUSTRY_COMPARISON.md) | practices from Prometheus, Elastic, Wazuh, Splunk vs ours |
| [evidence/](evidence/) | generated ML evaluation results |

## Running the tests

```bash
pnpm install                                   # once, at the repo root

cd apps/api
pnpm test                                      # unit tests (seconds)
pnpm test:integration                          # real-DB tests; starts PGlite, no Docker needed
SHOW_DEFECTS=1 pnpm test:integration           # show evidence for known defects

cd ../agent && pytest                          # needs: pip install -r requirements.txt pytest
cd ../ai-service && pytest                     # needs: pip install -r requirements.txt pytest
python -m evaluation.evaluate_anomaly_detection   # regenerates evidence/ML_EVALUATION_RESULTS.md
```

Integration tests truncate every table. They start their own throwaway database and
refuse to run against cloud hosts, so the shared Neon database is never touched.

## Conventions for contributors

- Test IDs (`TENANT-010`, `SIEM-031`, `ML-PRE-006`, …) appear in test names and in the
  traceability matrix.
- A known bug is written as a test of the **correct** behaviour and marked
  `knownDefect('DEF-xx', …)` (Jest) or `@pytest.mark.xfail(strict=True, reason="DEF-xx …")`.
  When you fix the bug, the test "unexpectedly passes" — remove the marker so it
  becomes a permanent regression test, and close the defect in the log.
- New endpoint? Add it to the RBAC matrix in `apps/api/test/rbac.int-spec.ts`;
  the route-policy scan will fail if it has no authentication guard.
