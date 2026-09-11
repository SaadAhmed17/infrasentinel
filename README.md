# InfraSentinel

AI-Augmented Operational Intelligence Platform for Multi-Server Infrastructure Monitoring.

A centralized, agent-based monitoring platform that collects real-time server metrics, detects anomalies using deep learning, correlates alerts through a custom SIEM rule engine, and explains incidents through a retrieval-augmented AI assistant.

## Status

Active development — Final Year Project (FYP), Air University Islamabad. Core platform substantially built; SIEM, LSTM anomaly detection, and RAG assistant all working with verified, real-data evidence across 6 of 15 target attack categories.

## Architecture

- **`apps/web`** — Next.js 15 + Tailwind + shadcn/ui dashboard
- **`apps/api`** — NestJS (Fastify) backend: auth, multi-tenancy, RBAC, organizations, servers, SIEM rule engine, anomaly/RAG proxies, API-usage middleware
- **`apps/ai-service`** — Python FastAPI: LSTM-Autoencoder anomaly detection, RAG-based AI incident assistant
- **`apps/agent`** — Lightweight Python agent (psutil) on monitored servers, pushing metrics via API key; also ships real SSH auth-log and sudo-command events

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, Tailwind, shadcn/ui, Recharts |
| Backend | NestJS, Fastify, Prisma |
| Database | Neon (Postgres) + pgvector |
| AI/LLM | Groq API (`openai/gpt-oss-120b`), PyTorch (LSTM-Autoencoder), sentence-transformers |
| Auth | Custom JWT + refresh tokens, RBAC via Guards |
| CI/CD | GitHub Actions |

## Features Implemented So Far

- [x] Multi-tenant architecture, JWT auth with refresh tokens, 6-role RBAC
- [x] Organization invitations and full member/role management UI
- [x] Server monitoring: 9-feature metrics, live multi-panel dashboards, full server CRUD (create/rename/delete), 3 genuinely separate VMs
- [x] Generic event/log pipeline — auth events, real SSH auth-log events, real sudo-command events, API request logging, all with IP/user tracking
- [x] SIEM rule engine — 6 rule types; full Rules/Incidents UI with create, edit, delete, one-click presets
- [x] Confirmed real-data attack detections: SSH brute-force, web login brute-force, credential stuffing, service crash, unauthorized root access, API abuse (6 of 15 scope-document attack types)
- [x] LSTM-Autoencoder anomaly detection — per-server trained models, real-time inference, auto-alerting integrated into the SIEM pipeline, live dashboard badge
- [x] RAG AI Incident Assistant — pgvector retrieval, multi-tenant isolated, hybrid semantic + recency search, date-aware generation, source-attributed chat UI, automatic incident indexing (no manual reindex needed)
- [x] Dashboard overview page — live server/incident/rule summary, recent alerts feed
- [x] CI pipeline (lint + build required before merge), unit tests for core auth/rule-engine logic

## Not Yet Built (Roadmap)

- [ ] Remaining 9 SIEM attack types (data exfiltration, log tampering, port scanning, ransomware, insider threat, cryptomining, direct DB attack, DoS — partially covered by LSTM)
- [ ] Notifications (email)
- [ ] Billing/subscription tiers (planned for commercial launch)

## AI / Anomaly Detection Architecture

`apps/ai-service` trains a separate LSTM-Autoencoder per monitored server, since each server has a different normal baseline. Pipeline:

1. `data_pipeline.py` — pulls raw metrics per server from Neon
2. `preprocess.py` — drops nulls, log-transforms skewed features (network/disk I/O), normalizes via per-server MinMaxScaler, builds sliding-window sequences (20 timesteps)
3. `train.py` — trains with early stopping, saves best-validation-loss checkpoint, derives an anomaly threshold from the 95th percentile of validation reconstruction error
4. `inference.py` — real-time scoring endpoint, exposed via FastAPI
5. NestJS (`AnomalyModule`) proxies scores and, on a 30-second schedule, auto-creates `Alert`/`Incident` records when anomalies are detected — unified with SIEM rule-based alerts in the same pipeline

## AI Assistant (RAG) Architecture

1. `rag.py` builds a plain-text summary of each Incident + its Alerts
2. Summaries are embedded (`sentence-transformers`, 384-dim) and stored in Postgres via `pgvector`
3. New incidents are embedded automatically the moment they're created — no manual reindex required for normal use
4. A question is embedded the same way; retrieval combines cosine-similarity search with the most recent incidents (hybrid retrieval), so date/recency questions work correctly — all filtered by organization **within the same SQL query**, so one tenant's incidents are never retrievable by another
5. Retrieved incidents plus the current date are passed to Groq (`openai/gpt-oss-120b`), which is instructed to answer only from that context and say so honestly if it can't
6. NestJS (`RagModule`) resolves `organizationId` from the authenticated JWT — never trusted from client input

## Local Development

**Prerequisites:** Node.js 22+, pnpm 11+, Python 3.11+

```bash
pnpm install
pnpm dev
```
Runs all three apps concurrently: web (`:3000`), api (`:3001`), ai-service (`:8001` in this dev environment).

See `apps/api/.env.example`, `apps/web/.env.local` (create from example), `apps/agent/.env.example`, and `apps/ai-service/.env.example` for required environment variables — including `GROQ_API_KEY` (free tier, console.groq.com) for the RAG assistant.

## Team

| Name | Role |
|---|---|
| Saad Ahmed | AI & Backend |
| Hashim Ahmed Khan | Backend & Monitoring Agents |
| Farhan Ali | Frontend |

Supervised by Ms. Quratulain Zahid, Air University Islamabad.

## Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md) — branch strategy, commit conventions, PR process
- [CHANGELOG.md](./CHANGELOG.md) — notable changes per version