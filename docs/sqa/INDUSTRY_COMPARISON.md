# How comparable platforms assure quality — and what we adopted

Monitoring and SIEM vendors publish parts of their testing practice, especially for
detection content. This compares those practices with InfraSentinel's.

Legend: ✅ adopted · ➕ recommended next · ✖ out of scope for an FYP.

| Practice | Who does it (public examples) | InfraSentinel | Decision |
|---|---|---|---|
| **Unit tests for alerting rules**: feed a defined input series at defined times, assert which alerts fire | Prometheus `promtool test rules` | SIEM scenario suite with frozen clock (53 tests, all 6 rule types) | ✅ core of our SIEM testing |
| **Rule/content validation in CI** (syntax, schema, required fields) | Elastic `detection-rules` repository (`python -m detection_rules test`) | route-policy scan; DTO validation tests; misconfigured-rule test (SIEM-009) | ✅ partly; ➕ conditional validation per rule type |
| **Replay sample logs through decoders/rules** | Wazuh `wazuh-logtest` | real `auth.log` line formats replayed through the unmodified agent parser | ✅ |
| **Replay recorded attack data** to confirm detections fire | Splunk `attack_data` / TOTAL-REPLAY | injected, labelled anomaly scenarios in the ML harness; scripted brute-force/stuffing timelines | ✅ at small scale; ➕ record real attacks on a test VM |
| **Tenant-isolation testing** | standard for multi-tenant SaaS; OWASP API1 (BOLA) | two-org adversarial suite incl. background jobs and vector search | ✅ top priority |
| **Load testing of ingestion** | k6 (Grafana Labs) is widely used for this | plan and criteria written | ➕ once an environment exists |
| **Dependency and secret scanning in CI** | common across vendors' public repos | report-only dependency audit job; history secret scan performed manually | ✅ / ➕ add a secret scanner to CI |
| **Full attack-range labs, continuous production testing, bug bounties, SOC 2 audits** | large commercial vendors | — | ✖ cost and scale beyond an FYP |

Classification of our techniques:

- **Standard QA practice**: unit/integration levels, BVA/EP, positive controls, CI gates, defect lifecycle, traceability.
- **Security-platform practice**: OWASP API Top-10 mapping, tenant-isolation suite, route-policy scan, dependency audit, responsible disclosure.
- **Inspired by comparable platforms**: rule scenario tests (Prometheus), log replay (Wazuh), attack-data replay (Splunk), rule validation (Elastic).
- **Chosen for InfraSentinel's architecture**: PGlite real-DB testing without Docker, RAG isolation with an adversarial nearest-neighbour, LSTM evaluation harness with injected anomalies, known-defect tests with evidence mode.

## Sources

- Prometheus — [Unit testing for rules](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/)
- Elastic — [detection-rules repository](https://github.com/elastic/detection-rules)
- Wazuh — [Testing decoders and rules](https://documentation.wazuh.com/current/user-manual/ruleset/testing.html)
- Splunk — [TOTAL-REPLAY blog](https://www.splunk.com/en_us/blog/security/total-replay-splunk-attack-data-testing.html), [attack_data](https://github.com/splunk/attack_data)
