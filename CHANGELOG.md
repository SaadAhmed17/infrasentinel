# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Multi-tenant architecture, JWT auth with refresh tokens and automatic silent-refresh, 6-role RBAC
- Organization invitations, full member invite/role management UI
- Server monitoring: 9-feature metrics agent, live multi-panel dashboards, full server CRUD (create, rename, delete)
- Generic Event pipeline: auth events, real SSH auth-log events, real sudo-command events, API request logging
- SIEM rule engine — 6 rule types (metric-threshold, event-frequency, heartbeat-missing, credential-stuffing, anomaly-detection, unusual-access); scheduled evaluation with deduplication and alert-to-incident correlation
- Full Rules and Incidents management UI: create, edit, delete, one-click presets
- Confirmed real-data attack detections: SSH brute-force, web login brute-force, credential stuffing, service crash, unauthorized root access, API abuse
- LSTM-Autoencoder anomaly detection: per-server training pipeline, real-time inference, automatic alerting integrated into the SIEM pipeline, live dashboard badge
- RAG AI Incident Assistant: pgvector retrieval, multi-tenant isolation, hybrid semantic + recency retrieval, date-aware generation, source-attributed chat UI, automatic incident indexing on creation
- Dashboard overview page with live summary cards and recent alerts feed
- CI pipeline, unit tests for core auth/rule-engine logic

### Fixed
- CORS configuration missing PATCH method
- Generic incident titles now use the triggering rule's name
- Several Python path-resolution bugs in ai-service that only surfaced depending on process launch directory
- Groq client instantiation made lazy so importing the AI service doesn't require a live API key
- RAG retrieval failing to surface recent/date-specific incidents (added hybrid retrieval + current-date system prompt)
- NestJS middleware dependency resolution requiring explicit re-export of imported modules

### Planned
- Remaining SIEM attack types (data exfiltration, log tampering, port scanning, ransomware, insider threat, cryptomining, direct DB attack)
- Email notifications
- Billing/subscription tiers