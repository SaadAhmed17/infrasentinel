"""Synthetic server telemetry with labelled, injected anomalies.

Used by the unit tests and by the model evaluation harness. Real telemetry has no
ground-truth labels, so we generate 'healthy' behaviour ourselves and inject
anomalies at known positions; every sample then has a correct label.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

SAMPLE_SECONDS = 10  # the agent's default push interval


def normal_telemetry(rows, seed=0, start=datetime(2026, 9, 1, tzinfo=timezone.utc)):
    """Healthy-server telemetry: periodic load pattern plus Gaussian noise on all
    nine model features, so 'normal' is realistic but learnable."""
    rng = np.random.default_rng(seed)
    t = np.arange(rows)
    wave = np.sin(2 * np.pi * t / 180)
    df = pd.DataFrame({
        "cpuUsage": np.clip(30 + 10 * wave + rng.normal(0, 2, rows), 0, 100),
        "memUsage": np.clip(55 + 5 * wave + rng.normal(0, 1, rows), 0, 100),
        "diskUsage": np.clip(60 + rng.normal(0, 0.2, rows), 0, 100),
        "networkIn": np.abs(50_000 + 20_000 * wave + rng.normal(0, 5_000, rows)),
        "networkOut": np.abs(20_000 + 8_000 * wave + rng.normal(0, 2_000, rows)),
        "diskReadRate": np.abs(10_000 + rng.normal(0, 2_000, rows)),
        "diskWriteRate": np.abs(30_000 + 10_000 * wave + rng.normal(0, 3_000, rows)),
        "processCount": (250 + rng.integers(-5, 6, rows)).astype(float),
        "loadAverage": np.abs(1.0 + 0.3 * wave + rng.normal(0, 0.05, rows)),
    })
    df["timestamp"] = [start + timedelta(seconds=SAMPLE_SECONDS * i) for i in range(rows)]
    return df


@dataclass(frozen=True)
class AnomalyType:
    name: str
    scenario: str
    length: int  # samples

    def apply(self, df, start, rng):
        end = start + self.length
        idx = df.index[start:end]
        n = len(idx)
        if self.name == "cpu_spike":
            df.loc[idx, "cpuUsage"] = rng.uniform(95, 100, n)
        elif self.name == "sustained_cpu":
            df.loc[idx, "cpuUsage"] = np.clip(df.loc[idx, "cpuUsage"] + 35, 0, 100)
        elif self.name == "memory_leak":
            df.loc[idx, "memUsage"] = np.clip(df.loc[idx, "memUsage"] + np.linspace(0, 35, n), 0, 100)
        elif self.name == "network_flood":
            df.loc[idx, "networkIn"] *= 40
        elif self.name == "exfiltration":
            df.loc[idx, "networkOut"] *= 60
        elif self.name == "disk_burst":
            df.loc[idx, "diskWriteRate"] *= 80
            df.loc[idx, "diskReadRate"] *= 20
        elif self.name == "fork_bomb":
            df.loc[idx, "processCount"] += 600
            df.loc[idx, "loadAverage"] += 8
        elif self.name == "subtle_drift":
            df.loc[idx, "cpuUsage"] = np.clip(df.loc[idx, "cpuUsage"] + 6, 0, 100)
            df.loc[idx, "memUsage"] = np.clip(df.loc[idx, "memUsage"] + 4, 0, 100)
        else:
            raise ValueError(self.name)


ANOMALY_TYPES = [
    AnomalyType("cpu_spike", "crypto-miner burst: CPU 95-100% for 1 min", 6),
    AnomalyType("sustained_cpu", "runaway process: CPU +35 points for 10 min", 60),
    AnomalyType("memory_leak", "memory leak: +0 to +35 points over 15 min", 90),
    AnomalyType("network_flood", "inbound flood (DDoS): network in x40 for 3 min", 18),
    AnomalyType("exfiltration", "data exfiltration: network out x60 for 3 min", 18),
    AnomalyType("disk_burst", "ransomware-like I/O: disk write x80, read x20 for 3 min", 18),
    AnomalyType("fork_bomb", "fork bomb: +600 processes, load +8 for 2 min", 12),
    AnomalyType("subtle_drift", "subtle drift: CPU +6, memory +4 points for 15 min (hard case)", 90),
]


def labelled_test_stream(seed=99, episodes_per_type=2, gap=60, lead_in=120):
    """Normal telemetry with each anomaly type injected `episodes_per_type` times.

    Returns (df, sample_labels, episodes) where episodes are
    (type, start_index, end_index_exclusive).
    """
    rng = np.random.default_rng(seed)
    plan = [t for _ in range(episodes_per_type) for t in ANOMALY_TYPES]
    rows = lead_in + sum(t.length + gap for t in plan) + gap
    df = normal_telemetry(rows, seed=seed, start=datetime(2026, 9, 3, tzinfo=timezone.utc))
    labels = np.zeros(rows, dtype=bool)
    episodes, cursor = [], lead_in
    for anomaly in plan:
        anomaly.apply(df, cursor, rng)
        labels[cursor:cursor + anomaly.length] = True
        episodes.append((anomaly, cursor, cursor + anomaly.length))
        cursor += anomaly.length + gap
    return df, labels, episodes
