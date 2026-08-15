# InfraSentinel

AI-Augmented Operational Intelligence Platform for Multi-Server Infrastructure Monitoring.

A centralized, agent-based monitoring platform that collects real-time server metrics, detects anomalies using deep learning, and correlates alerts through a custom SIEM rule engine — with an AI assistant for incident explanation.

## Status

Active development — Final Year Project (FYP), Air University Islamabad. Currently in Phase 1 (Core MVP).

## Architecture

- **`apps/web`** — Next.js 15 + Tailwind + shadcn/ui dashboard
- **`apps/api`** — NestJS (Fastify) backend: auth, multi-tenancy, RBAC, organizations, servers, metrics ingestion
- **`apps/ai-service`** — Python FastAPI: LSTM-Autoencoder anomaly detection, RAG-based AI assistant *(in progress)*
- **`apps/agent`** — Lightweight Python agent (psutil) that runs on monitored servers, pushing metrics via API key

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, Tailwind, shadcn/ui, Recharts |
| Backend | NestJS, Fastify, Prisma |
| Database | Neon (Postgres) + pgvector |
| AI/LLM | Groq API (Llama 3.x), PyTorch (LSTM-Autoencoder) |
| Auth | Custom JWT + refresh tokens, RBAC via Guards |
| Real-time | Socket.io *(planned)* |
| CI/CD | GitHub Actions |

## Features Implemented So Far

- [x] Multi-tenant architecture (Organization → Users, discriminator-column pattern)
- [x] Custom JWT auth with refresh tokens (silent refresh on frontend), RBAC via roles
- [x] Organization invitations (invite-link flow, full UI for inviting/promoting members)
- [x] Server registration with API-key-based agent authentication
- [x] Real-time metrics ingestion — 9 features: CPU, memory, disk usage, network I/O, disk I/O rate, process count, load average
- [x] Live dashboard: server list, per-server multi-panel metrics charts (Recharts)
- [x] Generic event/log pipeline (Event model) — auth events with IP tracking
- [x] SIEM rule engine — 4 rule types: metric-threshold, event-frequency, heartbeat-missing, credential-stuffing
- [x] Alert-to-incident correlation, Rules & Incidents management UI
- [x] LSTM-Autoencoder anomaly detection — per-server trained models, real-time inference, auto-alerting integrated into the SIEM pipeline
- [x] CI pipeline (lint + build on every PR, required to pass before merge)

## Not Yet Built (Roadmap)

- [ ] RAG-based AI incident assistant
- [ ] Notifications (email)
- [ ] Delete functionality for rules/servers
- [ ] Dashboard overview page (servers/alerts/incidents summary at a glance)
- [ ] SIEM Tier 2/3 rules (SSH brute-force, unauthorized root access, API abuse, ransomware disk-write detection)
- [ ] Automated tests (unit/e2e) — flagged honestly below

## AI / Anomaly Detection Architecture

`apps/ai-service` trains a separate LSTM-Autoencoder per monitored server (not one shared model), since each server has a different normal baseline. Pipeline:

1. `data_pipeline.py` — pulls raw metrics per server from Neon
2. `preprocess.py` — drops nulls, log-transforms skewed features (network/disk I/O), normalizes via per-server MinMaxScaler, builds sliding-window sequences (20 timesteps)
3. `train.py` — trains with early stopping, saves best-validation-loss checkpoint, derives an anomaly threshold from the 95th percentile of validation reconstruction error
4. `inference.py` — real-time scoring endpoint, exposed via FastAPI
5. NestJS (`AnomalyModule`) proxies scores and, on a 30-second schedule, auto-creates `Alert`/`Incident` records when anomalies are detected — unified with SIEM rule-based alerts in the same pipeline

## Local Development

**Prerequisites:** Node.js 22+, pnpm 11+, Python 3.11+

```bash
pnpm install
pnpm dev
```
Runs all three apps concurrently: web (`:3000`), api (`:3001`), ai-service (`:8000`).

See `apps/api/.env.example`, `apps/web/.env.local` (create from example), and `apps/agent/.env.example` for required environment variables.

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