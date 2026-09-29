# Test execution report — cycle 1

| | |
|---|---|
| Date | 2026-09-30 |
| Code under test | `develop` @ `c1f7b6a` + test-only changes on `sqa/foundation` |
| Executed by | Hashim Ahmad (SQA) |
| Machine | Windows 10 Pro 22H2, Node 24.5.0, Python 3.13.5, pnpm 11.11.0 |
| Database | PGlite 0.5.8 (PostgreSQL 18.3 + pgvector, in-process); CI: `pgvector/pgvector:pg16` |

## Baseline before this work

| Measure | Value |
|---|---|
| Automated tests | 7 (3 files, backend only); 2 were framework scaffolding ("Hello World") |
| Tests in CI | none (lint + build only; no CI on `team-dev`) |
| Backend statement coverage | 17.8% |
| E2E test | broken (Express-based, required a database) |
| Python / ML / RAG / security tests | none |

## Results

| Suite | Command | Tests | Pass | Known defect (expected fail) | Unexpected fail | Time |
|---|---|---|---|---|---|---|
| API unit | `pnpm --filter api test` | 35 | 34 | 1 | 0 | 15 s |
| API integration — RBAC | `pnpm --filter api test:integration` | 134 | 128 | 6 | 0 | |
| API integration — SIEM & incidents | ″ | 53 | 44 | 9 | 0 | |
| API integration — ingestion & logging | ″ | 44 | 37 | 7 | 0 | |
| API integration — auth | ″ | 29 | 25 | 4 | 0 | |
| API integration — tenant isolation | ″ | 25 | 22 | 3 | 0 | |
| API integration — smoke | ″ | 2 | 2 | 0 | 0 | 27 s total |
| Agent | `cd apps/agent && pytest` | 29 | 25 | 4 | 0 | 1 s |
| AI service (ML, RAG, API) | `cd apps/ai-service && pytest` | 47 | 42 | 5 | 0 | 20 s |
| **Total** | | **398** | **359** | **39** | **0** | ~65 s |
| ML evaluation harness | `python -m evaluation.evaluate_anomaly_detection` | 1 benchmark | F1 0.914 | — | — | 40 s |

"Known defect" tests encode correct behaviour and currently fail because of a logged
defect; each was checked in evidence mode (`SHOW_DEFECTS=1`, `pytest --runxfail`) to
confirm it fails for the stated reason and not for an incidental error. That check
caught one test that was failing for the wrong reason (AI-API-004, stub applied to
the wrong module), which was corrected before being counted.

## Coverage (evidence, not a target)

| Component | Statements | Branches | Notes |
|---|---|---|---|
| API — integration suite | **94.7%** | 76.8% | up from 17.8% baseline; uncovered: bootstrap, a few error branches |
| API — unit suite | 56.4% | 47.9% | unit tests target guards, clients, middleware |
| Agent | 86% | — | uncovered: the infinite `main()` loops |
| AI service | 88% | — | `data_pipeline.py` 37% (live-DB extraction; exercised by real training only) |

## Stability (flakiness check)

- API integration suite run repeatedly (2 × full, 8 × SIEM file): one intermittent
  failure found in INC-006 — it depended on the order in which two async database
  queries executed. Redesigned to assert the order of calls (deterministic), then
  8/8 consecutive green runs.
- Python suites run ≥ 2 × each: stable.
- CI path validated locally: integration suite run against an external database via
  `TEST_DATABASE_URL`, exactly as the GitHub Actions job does → 287/287.

## Defects found this cycle

40 logged ([DEFECT_LOG.md](DEFECT_LOG.md)): **2 Critical, 6 High, 19 Medium, 13 Low**;
3 fixed on this branch (all in test/CI infrastructure). 29 product defects are
reproduced by automated tests (39 known-defect tests; some defects have several).

## Not executed this cycle

- GitHub Actions run of the new pipeline (requires pushing the branch).
- Frontend E2E tests (UI redesign in progress on `team-dev`).
- Load/performance tests (see [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md)).

## How to reproduce

```bash
pnpm install
cd apps/api && pnpm test && pnpm test:integration        # no Docker needed
cd ../agent && python -m venv venv && venv/Scripts/pip install -r requirements.txt pytest && venv/Scripts/pytest
cd ../ai-service && python -m venv venv && venv/Scripts/pip install -r requirements.txt pytest && venv/Scripts/pytest
venv/Scripts/python -m evaluation.evaluate_anomaly_detection
```
