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
- [x] Organization invitations (invite-link flow)
- [x] Server registration with API-key-based agent authentication
- [x] Real-time metrics ingestion (CPU, memory, disk) + live dashboard charts
- [x] Generic event/log pipeline (Event model) — auth events (login success/failure) recorded
- [x] SIEM rule engine: metric-threshold rules + event-frequency rules (e.g. brute-force login detection)
- [x] Alert-to-incident correlation, Rules & Incidents management UI
- [x] CI pipeline (lint + build on every PR)

## Not Yet Built (Roadmap)

- [ ] LSTM-Autoencoder anomaly detection
- [ ] RAG-based AI incident assistant
- [ ] Notifications (email)
- [ ] Delete functionality for rules/servers
- [ ] Dashboard overview (currently shows only org members — needs servers/alerts/incidents summary)

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