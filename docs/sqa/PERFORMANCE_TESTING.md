# Performance testing plan

Status: **planned, not yet executed.** No production-like environment exists yet: the
shared Neon database must not be load-tested, and PGlite (single-process WebAssembly
PostgreSQL) would produce misleading numbers. Stating this is better than reporting
figures that do not represent the real system.

## Why performance matters here

Every monitored server pushes a metric every 10 s, and each push causes two database
writes (server heartbeat update and metric insert; on `develop` a third one, an
`API_REQUEST` event — DEF-10, fixed on `team-dev`). User API requests are logged as
`API_REQUEST` events, one write each. The rule engine re-reads recent metrics for every
server every 30 s, and inference reads a server's *entire* history per score (DEF-33).
Cost therefore grows with both fleet size and time.

## Planned scenarios

| ID | Scenario | Load | Measures | Acceptance criterion (initial) |
|---|---|---|---|---|
| PERF-01 | Ingestion throughput | 10 → 100 → 500 simulated agents, 1 push / 10 s, 15 min | p50/p95/p99 latency, error rate, DB writes/s | p95 < 200 ms, errors < 0.1% at 100 agents |
| PERF-02 | Ingestion burst | 500 agents reconnect simultaneously | recovery time, dropped pushes | no 5xx; queue drains < 60 s |
| PERF-03 | Rule-engine tick duration | 50 servers × 6 rules, 24 h of history | tick time vs 30 s budget | tick < 10 s (no overlapping ticks) |
| PERF-04 | Dashboard queries | 20 concurrent users polling | p95 of `/servers`, `/incidents/dashboard-summary` | p95 < 300 ms |
| PERF-05 | AI inference latency vs history size | 1k, 10k, 100k metric rows per server | `/anomaly-score` latency | grows sub-linearly (currently expected linear — DEF-33) |
| PERF-06 | RAG query latency | 1k incidents per org | retrieval + LLM time | retrieval < 200 ms |

## Tooling and environment (when executed)

- **k6** (scriptable HTTP load generator from Grafana Labs) for PERF-01/02/04 —
  agent traffic is simple JSON over HTTP with a header, which k6 models directly.
- A disposable Neon branch or a Postgres container sized like production; API and DB
  on separate hosts; results recorded with hardware, dataset size, duration, and
  resource usage (CPU/RAM of API, DB connections).

## What will be reported

Environment, load profile, duration, latency percentiles, throughput, error rate,
resource usage, and the limitations of the setup — never a single "it's fast" number.
