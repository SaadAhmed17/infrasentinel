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

### Planned
- LSTM-Autoencoder anomaly detection
- SIEM rule correlation engine
- RAG-based AI incident assistant