# Validating the LSTM-Autoencoder anomaly detector

## The core difficulty

The detector is **unsupervised**: it learns "normal" from a server's own history and
flags windows it reconstructs badly. Real telemetry has **no labels**, so ordinary
pass/fail tests can verify the *pipeline* but cannot say *how good* the detector is.
We therefore validate in two layers:

| Layer | Question | How |
|---|---|---|
| 1. Pipeline correctness | Is the model built and used correctly? | 32 unit/integration tests |
| 2. Detection quality | How well does it separate normal from abnormal? | reproducible evaluation harness with labelled, injected anomalies |

## Layer 1 — pipeline tests (`apps/ai-service/tests/`)

| Property | Why it matters | Tests |
|---|---|---|
| Nulls dropped; log transform on skewed columns only | wrong scaling silently distorts what "normal" means | ML-PRE-001, 002 |
| Sliding windows: exact counts at 19/20/21 rows, stride 1, order preserved | off-by-one errors create misaligned sequences | ML-PRE-003, 004 |
| **Chronological** 90/10 split | a random split lets the model "see the future" | ML-PRE-005 |
| **Scaler fitted on training data only** | fitting on validation data leaks information and inflates results | ML-PRE-006 (an extreme value placed only in validation must not reach the scaler) |
| Deterministic pre-processing | results must be reproducible | ML-PRE-007 |
| Output shape = input shape; deterministic in eval mode; can overfit a tiny batch | catches wiring and gradient bugs | ML-MOD-001..003 |
| Threshold = 95th percentile of validation error (recomputed independently) | the alerting decision depends on it | ML-TRN-002 |
| Early stopping saves the **best** epoch, not the last | a worse model and a threshold computed from it | ML-TRN-005 (validation data busier than training data, so the best epoch is clearly not the last) |
| Servers that never report a feature (Windows: no load average) can still be trained; one failing server does not stop the others | otherwise no model for Windows hosts, and one server blocks all | ML-PRE-009..011, ML-TRN-004 |
| Strict `error > threshold` boundary (identity model, error = 0) | boundary behaviour of the alert decision | ML-INF-006 |
| Missing model / fewer than 20 readings → explained error, not a crash | graceful degradation for new servers | ML-INF-001, 002 |
| Healthy window not flagged; obvious attack flagged | end-to-end sanity | ML-INF-003, 004 |

Defects found: DEF-28 (cryptic crash with too little history), DEF-37 (artifact path
depends on the working directory), DEF-43 (Windows servers untrainable; one failure
aborted training for all servers), DEF-46 (the saved model was the last epoch, not the
best). All four are fixed on `team-dev`.

## Layer 2 — detection quality (`apps/ai-service/evaluation/`)

**Method.** Train with the project's own `preprocess.py` + `train.py` (unchanged
hyper-parameters, early stopping) on 3,000 healthy samples (~8.3 h at 10 s). Score a
separate labelled stream containing 16 injected episodes of 8 scenarios, using the
exact production scoring steps. A window is labelled anomalous if it contains any
anomalous sample. Everything is seeded; `python -m evaluation.evaluate_anomaly_detection`
regenerates [the results](evidence/ML_EVALUATION_RESULTS.md) in about 40 seconds.

Re-run on the `team-dev` code (2026-10-06, after the DEF-43 and DEF-46 fixes): identical
numbers. In this benchmark training runs all 50 epochs and the last epoch has the lowest
validation loss, so keeping the best epoch changes nothing here; on real data with early
stopping it does (ML-TRN-005).

**Headline (production 95th-percentile threshold):**

| Precision | Recall | F1 | False-positive rate | ROC-AUC |
|---|---|---|---|---|
| 0.964 | 0.869 | 0.914 | 0.037 | 0.958 |

**Per scenario** (window recall vs. chance level 0.037):

| Scenario | Window recall | Median latency | Static `CPU > 90%` rule |
|---|---|---|---|
| Crypto-miner burst (CPU 95–100%, 1 min) | 1.00 | 0 s | 2/2 |
| Runaway process (CPU +35, 10 min) | 0.99 | 0 s | 0/2 |
| Memory leak (+0→+35 over 15 min) | 0.84 | 170 s | 0/2 |
| Inbound flood / DDoS (network in ×40) | 1.00 | 0 s | 0/2 |
| Data exfiltration (network out ×60) | 1.00 | 0 s | 0/2 |
| Ransomware-like disk I/O | 1.00 | 0 s | 0/2 |
| Fork bomb (+600 processes) | 1.00 | 0 s | 0/2 |
| Subtle drift (CPU +6, memory +4, 15 min) | 0.60 | 120 s | 0/2 |

**Interpretation.**

- The LSTM catches multivariate anomalies a single threshold rule cannot (7 of 8
  scenarios vs 1 of 8) — this is the evidence for using ML at all.
- A **false positive** here is a healthy window flagged (30 of 817). A **false
  negative** is an anomalous window missed (122 of 928) — mostly early windows of
  slow-onset anomalies (memory leak, drift), which is why their latency is higher.
- The threshold is a trade-off: at the 99th percentile the false-positive rate falls
  to 1.2% but recall drops to 0.81 (full table in the evidence file). The team can
  choose per server.
- Operationally, a 3.7% false-positive rate on a 30-second evaluation cycle would be
  ~4 false alarms per server per hour if nothing suppressed repeats. Alert
  de-duplication hides repeats while an alert is open; since DEF-06 is fixed, a breach
  after the incident is resolved alerts again, as it should.

**Methodological caution applied.** "Episode detected if any overlapping window is
flagged" is inflated for long episodes (with ~100 overlapping windows at a 3.7%
false-positive rate, one false flag is almost certain). We therefore report window
recall against the false-positive rate as chance level.

## The team's trained models (checked 2026-10-06)

The three models the team trained outside Git (shared as files, not in the repository)
load and score correctly, with two findings:

- **Threshold rule differs from the code (DEF-54).** Their thresholds are about 1.5 × the
  99th percentile of validation error; `train.py` uses the 95th percentile. Measured:
  the stored thresholds give almost no false alarms but miss CPU and memory spikes; the
  code's rule catches most spikes but would give about 144 false alarms per server per
  day. The team should choose one rule, keep it in `train.py`, and retrain so that code
  and models agree.
- **Unknown servers.** They were trained for servers that are not in the current team
  database, so they cannot score live data until those servers exist or the models are
  retrained on the current servers.

## Limitations (stated honestly)

1. **Synthetic data.** Real servers are noisier; "subtle drift" here is a 3–4σ shift
   relative to the generator's noise, so real-world drift detection will be weaker.
2. **Contamination.** Training assumes the history is healthy; if an attack is in the
   training window, it becomes "normal". No filtering exists yet.
3. **One model per server** needs enough history (≥ ~200 rows) before it works.
4. **Stale inference**: the latest 20 readings are scored even if they are old
   (server offline), and the whole history is read on each call (DEF-33).

**Next step** toward real-world evidence: record labelled attack sessions on a test VM
(e.g. a real fork bomb, `stress-ng`, an `iperf` flood) and replay them through the
harness — the approach Splunk's attack-data replay uses for detection testing.
