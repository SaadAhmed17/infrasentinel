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
- Member invite/role management UI, accept-invite page
- Scheduled rule evaluation engine with deduplication
- Alert-to-incident correlation
- Rules management page and Incidents dashboard (frontend)
- Refresh token endpoint with automatic silent-refresh on the frontend
- SIEM rule engine: metric-threshold, event-frequency, heartbeat-missing, and credential-stuffing rule types
- Alert-to-incident correlation, Rules and Incidents management UI
- Extended metric schema: network I/O, disk I/O rate, process count, load average (9 features total)
- LSTM-Autoencoder anomaly detection: per-server training pipeline, real-time inference service, automatic alerting integrated into the SIEM pipeline
- Live anomaly status badge on server detail dashboard

### Planned
- LSTM-Autoencoder anomaly detection
- SIEM rule correlation engine
- RAG-based AI incident assistant

