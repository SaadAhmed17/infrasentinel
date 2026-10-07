# Test execution report

| | |
|---|---|
| Latest run | 2026-10-06 — `team-dev` @ `45ea3b9` (all fixes and the test suite; see [FIX_VERIFICATION_REPORT.md](FIX_VERIFICATION_REPORT.md)) |
| Cycle 1 | 2026-09-30 — `develop` @ `c1f7b6a` + test-only changes |
| Executed by | Hashim Ahmad (SQA) |
| Machine | Windows 10 Pro 22H2, Node 24.5.0, Python 3.13.5, pnpm 11.11.0 |
| Database | PGlite 0.5.8 (PostgreSQL + pgvector, in-process); CI: `pgvector/pgvector:pg16` |

## Baseline before this work

| Measure | Value |
|---|---|
| Automated tests | 7 (3 files, backend only); 2 were framework scaffolding ("Hello World") |
| Tests in CI | none (lint + build only; no CI on `team-dev`) |
| Backend statement coverage | 17.8% |
| E2E test | broken (Express-based, required a database) |
| Python / ML / RAG / security tests | none |

## Results on `team-dev` (2026-10-06)

| Suite | Command | Tests | Pass | Known defect (expected fail) | Unexpected fail | Time |
|---|---|---|---|---|---|---|
| API unit | `pnpm --filter api test` | 50 | 48 | 2 (DEF-26, DEF-27) | 0 | 12 s |
| API integration — RBAC | `pnpm --filter api test:integration` | 133 | 133 | 0 | 0 | |
| API integration — SIEM & incidents | ″ | 56 | 56 | 0 | 0 | |
| API integration — SIEM regressions | ″ | 35 | 35 | 0 | 0 | |
| API integration — ingestion, logging & monitoring | ″ | 49 | 49 | 0 | 0 | |
| API integration — auth | ″ | 29 | 25 | 4 (DEF-12 ×2, DEF-13, DEF-23) | 0 | |
| API integration — password reset | ″ | 11 | 11 | 0 | 0 | |
| API integration — tenant isolation | ″ | 27 | 27 | 0 | 0 | |
| API integration — smoke | ″ | 2 | 2 | 0 | 0 | 41 s total |
| Agent | `cd apps/agent && pytest` | 31 | 28 | 3 (DEF-29 ×2, DEF-35) | 0 | 1 s |
| AI service (ML, RAG, API) | `cd apps/ai-service && pytest` | 78 | 76 | 2 (DEF-25, DEF-27) | 0 | 33 s |
| **Total** | | **501** | **490** | **11** | **0** | ~90 s |
| ML evaluation harness | `python -m evaluation.evaluate_anomaly_detection` | 1 benchmark | F1 0.914 | — | — | 42 s |

Also green on the same commit: API lint, type-check and build; web lint (1 pre-existing
warning), type-check and production build; ruff.

"Known defect" tests encode correct behaviour and fail only because of a logged, still
open defect. Each was checked in evidence mode (`SHOW_DEFECTS=1`, `pytest --runxfail`)
to confirm it fails for the stated reason and not for an incidental error.

### Cycle 1 for comparison (2026-09-30, `develop`)

399 tests: 359 pass, 40 known defects, 0 unexpected failures. Since then the known-defect
tests went from 40 to 11: those of fixed defects are now normal regression tests. New
tests were added for the fixes, for forgot password (PWR-001..011 and 6 unit tests) and
for the defects found while fixing (REG-001..070, ML-TRN-005, SEC-AI-001..003). Tests of
features that `team-dev` does not have were removed: automatic and single-incident RAG
indexing (INC-005, INC-006 — DEF-18 —, RAG-U05, RAG-I06) and the server rename/delete
endpoints (AGENT-012, AGENT-015, the `PATCH`/`DELETE /servers/:id` RBAC rows).

## Coverage (evidence, not a target)

| Component | Statements | Branches | Notes |
|---|---|---|---|
| API — integration suite | **94.4%** | 77.7% | cycle 1: 94.7% / 76.8% (17.8% before this work); uncovered: bootstrap, a few error branches |
| API — unit suite | 55.3% | 44.5% | unit tests target guards, clients, middleware, password reset, rule engine helpers |
| Agent | 87% | — | product code only; uncovered: the infinite `main()` loops |
| AI service | 93% | — | product code only (tests and the evaluation harness excluded); `data_pipeline.py` 37% (live-DB extraction, exercised by real training only) |

## Stability (flakiness check)

- Cycle 1: the API integration suite was run repeatedly (2 × full, 8 × SIEM file); one
  intermittent failure (INC-006, order of two async queries) was redesigned, then 8/8
  green runs.
- This cycle: every suite was run at least 3 times on the final code with no
  intermittent failures. Time-window tests use a frozen clock.
- CI path: the integration suite also runs against an external PostgreSQL through
  `TEST_DATABASE_URL`, exactly as the GitHub Actions job does.

## Defects

54 logged ([DEFECT_LOG.md](DEFECT_LOG.md)): 2 Critical, 7 High, 27 Medium, 18 Low.
On `team-dev` (2026-10-08): 36 fixed, 3 partly fixed, 15 open. DEF-46..DEF-54 were
found during this cycle: DEF-52 by a team member testing forgot password, DEF-54 by
analysing the team's trained model files, the others while reviewing and testing the
SIEM and ML code.

## Not executed yet

- GitHub Actions run of the pipeline (runs when `team-dev` is pushed).
- Live re-run of the system test on `team-dev` (cycle 1 ran it on `main`; see [SYSTEM_TEST_REPORT.md](SYSTEM_TEST_REPORT.md)).
- Frontend E2E tests (the frontend has no test runner yet).
- Load/performance tests (see [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md)).

## How to reproduce

```bash
pnpm install
cd apps/api && pnpm test && pnpm test:integration        # no Docker needed
cd ../agent && python -m venv venv && venv/Scripts/pip install -r requirements.txt pytest && venv/Scripts/pytest
cd ../ai-service && python -m venv venv && venv/Scripts/pip install -r requirements.txt pytest && venv/Scripts/pytest
venv/Scripts/python -m evaluation.evaluate_anomaly_detection
```
