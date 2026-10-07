"""Model evaluation harness for the LSTM-Autoencoder anomaly detector.

Answers the question unit tests cannot: HOW WELL does the detector work?

1. Trains a model with the project's own pipeline (preprocess.py + train.py,
   unchanged hyper-parameters) on synthetic healthy telemetry.
2. Scores a separate, labelled test stream with 8 injected anomaly types, using
   exactly the production scoring steps from inference.py.
3. Reports window-level precision / recall / F1 / false-positive rate, ROC-AUC,
   per-scenario detection rate and latency, the threshold trade-off curve, and a
   comparison with a simple static rule (CPU > 90%).

Everything is seeded, so results are reproducible. Limitation (stated in the
report): the data is synthetic; real-world performance needs labelled incidents.

Usage (from apps/ai-service):  python -m evaluation.evaluate_anomaly_detection
"""

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import roc_auc_score

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

import inference
import preprocess
import train
from data_pipeline import FEATURE_COLUMNS
from evaluation.synthetic_telemetry import (
    ANOMALY_TYPES,
    SAMPLE_SECONDS,
    labelled_test_stream,
    normal_telemetry,
)

SERVER_ID = "evaluation-server"
TRAIN_ROWS = 3000  # ~8.3 hours of history at 10-second intervals
WINDOW = preprocess.WINDOW_SIZE
RULE_ENGINE_TICK_SECONDS = 30


def train_model(artifacts_dir):
    preprocess.ARTIFACTS_DIR = str(artifacts_dir)
    train.ARTIFACTS_DIR = str(artifacts_dir)
    preprocess.process_server(SERVER_ID, normal_telemetry(TRAIN_ROWS, seed=1))
    train.train_one_server(SERVER_ID)
    inference.ARTIFACTS_DIR = str(artifacts_dir)
    inference._model_cache.clear()
    return inference.load_server_artifacts(SERVER_ID)


def window_errors(df, artifacts):
    """Reconstruction error of every sliding window, scored exactly like
    inference.score_server() (log1p on skewed columns -> scaler -> model -> MSE)."""
    data = df[FEATURE_COLUMNS].copy()
    for col in preprocess.SKEWED_COLUMNS:
        data[col] = np.log1p(data[col])
    scaled = artifacts["scaler"].transform(data)
    windows = torch.tensor(preprocess.create_sequences(scaled, WINDOW), dtype=torch.float32)
    with torch.no_grad():
        return torch.mean((artifacts["model"](windows) - windows) ** 2, dim=(1, 2)).numpy()


def confusion(predicted, actual):
    tp = int(np.sum(predicted & actual))
    fp = int(np.sum(predicted & ~actual))
    tn = int(np.sum(~predicted & ~actual))
    fn = int(np.sum(~predicted & actual))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fpr = fp / (fp + tn) if fp + tn else 0.0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision,
            "recall": recall, "f1": f1, "false_positive_rate": fpr}


def per_scenario(flags, episodes):
    """An episode counts as detected if any window overlapping it is flagged.
    Latency = seconds from the anomaly's first sample to the end of the first
    flagged window (the earliest moment the system could have known).

    Caution: for LONG episodes 'any window flagged' is inflated by ordinary false
    positives (at a 3-4% false-positive rate, ~100 overlapping windows almost
    surely contain one). Window recall — the share of overlapping windows that
    are flagged — is therefore reported too and compared with the false-positive
    rate (the chance level): only a clear margin above it counts as reliable."""
    results = {}
    for anomaly in ANOMALY_TYPES:
        latencies, detected, overlapping, flagged = [], 0, 0, 0
        for kind, start, end in episodes:
            if kind is not anomaly:
                continue
            first_window, last_window = max(0, start - WINDOW + 1), min(len(flags) - 1, end - 1)
            hits = np.nonzero(flags[first_window:last_window + 1])[0]
            overlapping += last_window - first_window + 1
            flagged += len(hits)
            if len(hits):
                detected += 1
                window_end = first_window + hits[0] + WINDOW - 1
                latencies.append(max(0, window_end - start) * SAMPLE_SECONDS)
        total = sum(1 for kind, _, _ in episodes if kind is anomaly)
        results[anomaly.name] = {
            "scenario": anomaly.scenario,
            "detected": f"{detected}/{total}",
            "detection_rate": detected / total,
            "median_latency_s": float(np.median(latencies)) if latencies else None,
            "window_recall": flagged / overlapping,
        }
    return results


def static_rule_baseline(df, episodes):
    """What a plain 'CPU > 90%' threshold rule would catch, for comparison."""
    breach = (df["cpuUsage"] > 90).to_numpy()
    return {a.name: f"{sum(breach[s:e].any() for k, s, e in episodes if k is a)}"
                    f"/{sum(1 for k, _, _ in episodes if k is a)}" for a in ANOMALY_TYPES}


def evaluate(output_dir):
    torch.manual_seed(0)
    np.random.seed(0)
    started = time.time()

    with tempfile.TemporaryDirectory() as tmp:
        artifacts = train_model(Path(tmp))
        val = np.load(Path(tmp) / SERVER_ID / "val_sequences.npy")
        with torch.no_grad():
            v = torch.tensor(val, dtype=torch.float32)
            val_errors = torch.mean((artifacts["model"](v) - v) ** 2, dim=(1, 2)).numpy()

        df, sample_labels, episodes = labelled_test_stream()
        errors = window_errors(df, artifacts)
        # A window is truly anomalous if it contains at least one anomalous sample.
        window_labels = np.array([sample_labels[i:i + WINDOW].any() for i in range(len(errors))])

        threshold = artifacts["config"]["anomaly_threshold"]
        flags = errors > threshold
        headline = confusion(flags, window_labels)
        headline["false_alarms_per_server_per_hour"] = (
            headline["false_positive_rate"] * 3600 / RULE_ENGINE_TICK_SECONDS)

        tradeoff = []
        for pct in (90, 95, 97.5, 99, 99.5, 99.9):
            t = float(np.percentile(val_errors, pct))
            row = confusion(errors > t, window_labels)
            tradeoff.append({"percentile": pct, "threshold": t, **{k: row[k] for k in
                            ("precision", "recall", "f1", "false_positive_rate")}})

        report = {
            "setup": {
                "training_rows": TRAIN_ROWS, "sample_interval_s": SAMPLE_SECONDS,
                "window_size": WINDOW, "test_stream_rows": len(df), "test_windows": len(errors),
                "anomalous_windows": int(window_labels.sum()), "episodes": len(episodes),
                "production_threshold": threshold,
                "best_validation_loss": artifacts["config"]["best_val_loss"],
                "runtime_s": round(time.time() - started, 1),
            },
            "headline_at_production_threshold": headline,
            "roc_auc": float(roc_auc_score(window_labels, errors)),
            "per_scenario": per_scenario(flags, episodes),
            "static_cpu_rule_baseline": static_rule_baseline(df, episodes),
            "threshold_tradeoff": tradeoff,
        }

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "ml_evaluation.json").write_text(json.dumps(report, indent=2))
    (output_dir / "ML_EVALUATION_RESULTS.md").write_text(to_markdown(report), encoding="utf-8")
    return report


def to_markdown(r):
    s, h = r["setup"], r["headline_at_production_threshold"]
    lines = [
        "# LSTM-Autoencoder evaluation results",
        "",
        ("Generated by `apps/ai-service/evaluation/evaluate_anomaly_detection.py` "
        "(seeded, reproducible). **Synthetic data**: see limitations in ML_VALIDATION.md."),
        "",
        f"- Training: {s['training_rows']} healthy samples (~{s['training_rows'] * 10 / 3600:.1f} h at 10 s)",
        (f"- Test stream: {s['test_stream_rows']} samples, {s['test_windows']} windows "
        f"({s['anomalous_windows']} anomalous), {s['episodes']} injected episodes"),
        (f"- Production threshold ({train.THRESHOLD_PERCENTILE}th pct of validation error): "
         f"{s['production_threshold']:.6f}"),
        f"- Runtime: {s['runtime_s']} s",
        "",
        "## Headline (production threshold, window level)",
        "",
        "| Precision | Recall | F1 | False-positive rate | ROC-AUC | False alarms / server / hour* |",
        "|---|---|---|---|---|---|",
        (f"| {h['precision']:.3f} | {h['recall']:.3f} | {h['f1']:.3f} | {h['false_positive_rate']:.3f} "
        f"| {r['roc_auc']:.3f} | {h['false_alarms_per_server_per_hour']:.1f} |"),
        "",
        f"Confusion matrix: TP={h['tp']}, FP={h['fp']}, TN={h['tn']}, FN={h['fn']}.",
        "",
        ("*If every 30-second rule-engine evaluation of a healthy server had this false-positive rate. "
        "In the current system, alert de-duplication hides repeats (see DEF-06)."),
        "",
        "## Per scenario",
        "",
        (f"Window recall is the share of windows overlapping the anomaly that were flagged. "
        f"Chance level is the false-positive rate ({h['false_positive_rate']:.3f}): a scenario is "
        f"only reliably detected if its window recall is far above that."),
        "",
        "| Scenario | Episodes detected | Window recall | Median latency | Reliable? | `CPU > 90%` rule |",
        "|---|---|---|---|---|---|",
    ]
    for name, v in r["per_scenario"].items():
        latency = "-" if v["median_latency_s"] is None else f"{v['median_latency_s']:.0f} s"
        reliable = "yes" if v["window_recall"] >= 0.5 else "**no**"
        lines.append(f"| {v['scenario']} | {v['detected']} | {v['window_recall']:.2f} | {latency} "
                     f"| {reliable} | {r['static_cpu_rule_baseline'][name]} |")
    lines += ["", "## Threshold trade-off", "",
              "| Percentile | Precision | Recall | F1 | False-positive rate |", "|---|---|---|---|---|"]
    for t in r["threshold_tradeoff"]:
        lines.append(f"| {t['percentile']} | {t['precision']:.3f} | {t['recall']:.3f} | {t['f1']:.3f} "
                     f"| {t['false_positive_rate']:.3f} |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output", type=Path, default=SERVICE_DIR.parents[1] / "docs" / "sqa" / "evidence")
    result = evaluate(parser.parse_args().output)
    print(to_markdown(result))
