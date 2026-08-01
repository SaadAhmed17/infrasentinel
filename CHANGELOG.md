# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Multi-tenant architecture (Organizations, Users, RBAC)
- JWT authentication (signup, login, invite-based onboarding)
- Server registration with API-key agent authentication
- Metrics ingestion endpoint and Python monitoring agent (psutil)
- Dashboard: server list (live status/heartbeat) and per-server metrics charts
- CI pipeline (GitHub Actions: lint + build for web, api, ai-service)
- Generic Event model and EventsService — extensible log/event pipeline
- Auth event logging (login success/failure with IP tracking)
- SIEM Rule engine: metric-threshold and event-frequency rule types
- Scheduled rule evaluation engine with deduplication
- Alert-to-incident correlation
- Rules management page and Incidents dashboard (frontend)
- Refresh token endpoint with automatic silent-refresh on the frontend

### Planned
- LSTM-Autoencoder anomaly detection
- SIEM rule correlation engine
- RAG-based AI incident assistant

