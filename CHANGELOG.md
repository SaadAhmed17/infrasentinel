# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Multi-tenant architecture (Organizations, Users, RBAC), JWT auth with refresh tokens and automatic silent-refresh
- Organization invitations, full member invite/role management UI, accept-invite page
- Server registration with API-key agent authentication; Python monitoring agent (psutil), extended to 9 metric features (network I/O, disk I/O rate, process count, load average)
- Live dashboard: server list, per-server multi-panel metrics charts
- Generic Event model and EventsService — extensible log/event pipeline; auth event logging and real SSH auth-log ingestion, both with IP tracking
- SIEM rule engine: metric-threshold, event-frequency, heartbeat-missing, credential-stuffing, and anomaly-detection rule types; scheduled evaluation with deduplication
- Alert-to-incident correlation; Rules and Incidents management UI with create, edit, delete, and one-click presets
- Confirmed real-data attack detections: SSH brute-force, web login brute-force, credential stuffing, service crash
- LSTM-Autoencoder anomaly detection: per-server training pipeline, real-time inference service, automatic alerting integrated into the SIEM pipeline, live dashboard badge
- RAG AI Incident Assistant: pgvector retrieval, multi-tenant isolated, Groq generation, source-attributed chat UI, manual reindex
- Dashboard overview page with live summary cards and recent alerts feed
- CI pipeline (GitHub Actions: lint + build for web, api, ai-service), unit tests for core auth/rule-engine logic

### Fixed
- CORS configuration missing PATCH method (blocked role updates from the browser)
- Generic incident titles now use the triggering rule's name instead of a placeholder
- Several Python path-resolution bugs in ai-service (artifacts directory, .env loading) that only surfaced depending on process launch directory
- Groq client instantiation made lazy so importing the AI service no longer requires a live API key (fixed CI import check)

### Planned
- RAG Stage 3 (auto-index new incidents on creation)
- SIEM Tier 2/3 rules (unauthorized root access, API abuse, ransomware, port scanning, cryptomining)
- Server edit/delete UI