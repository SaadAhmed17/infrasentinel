"""Training and inference tests (ML-TRN-xxx, ML-INF-xxx).

A small model is trained once per test session on synthetic healthy telemetry,
using the project's real preprocess.py and train.py (only the epoch count is
reduced for speed). Inference is then exercised through the real score_server(),
with the database read replaced by in-memory telemetry.
"""

import json

import numpy as np
import pytest
import torch
from conftest import normal_telemetry

import inference
import preprocess
import train

SERVER = "srv-under-test"


@pytest.fixture(scope="session")
def trained_dir(tmp_path_factory):
    artifacts = tmp_path_factory.mktemp("artifacts")
    torch.manual_seed(0)
    patch = pytest.MonkeyPatch()
    patch.setattr(preprocess, "ARTIFACTS_DIR", str(artifacts))
    patch.setattr(train, "ARTIFACTS_DIR", str(artifacts))
    patch.setattr(train, "EPOCHS", 15)
    preprocess.process_server(SERVER, normal_telemetry(1500, seed=1))
    train.train_one_server(SERVER)
    patch.undo()
    return artifacts


@pytest.fixture
def scoring(trained_dir, monkeypatch):
    """score_server() wired to the trained artifacts and to fake 'recent metrics'."""
    monkeypatch.setattr(inference, "ARTIFACTS_DIR", str(trained_dir))
    monkeypatch.setattr(inference, "_model_cache", {})

    def score(recent_df, server_id=SERVER):
        monkeypatch.setattr(inference, "load_metrics_for_server", lambda _id: recent_df.copy())
        return inference.score_server(server_id)

    return score


def test_ML_TRN_001_training_saves_model_scaler_and_config(trained_dir):
    out = trained_dir / SERVER
    config = json.loads((out / "config.json").read_text())

    assert (out / "model.pt").exists() and (out / "scaler.pkl").exists()
    assert config["window_size"] == 20 and config["num_features"] == 9
    assert config["anomaly_threshold"] > 0


def test_ML_TRN_002_threshold_is_the_95th_percentile_of_validation_error(trained_dir, monkeypatch):
    monkeypatch.setattr(inference, "ARTIFACTS_DIR", str(trained_dir))
    monkeypatch.setattr(inference, "_model_cache", {})
    artifacts = inference.load_server_artifacts(SERVER)
    val = torch.tensor(np.load(trained_dir / SERVER / "val_sequences.npy"), dtype=torch.float32)

    with torch.no_grad():
        errors = torch.mean((artifacts["model"](val) - val) ** 2, dim=(1, 2)).numpy()

    assert artifacts["config"]["anomaly_threshold"] == pytest.approx(np.percentile(errors, 95), rel=1e-5)


@pytest.mark.xfail(strict=True, reason="DEF-28: too little history crashes training instead of a clear error")
def test_ML_TRN_003_too_little_history_fails_with_a_clear_message(tmp_path, monkeypatch):
    monkeypatch.setattr(preprocess, "ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setattr(train, "ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setattr(train, "EPOCHS", 2)
    preprocess.process_server("tiny", normal_telemetry(60))  # 6 validation rows < one window

    with pytest.raises(ValueError, match="(?i)not enough"):
        train.train_one_server("tiny")


def test_ML_INF_001_server_without_a_model_gets_an_explanatory_error(scoring):
    result = scoring(normal_telemetry(50), server_id="never-trained")

    assert "No trained model" in result["error"]


@pytest.mark.parametrize("rows, has_score", [(19, False), (20, True)], ids=["19 readings", "20 readings"])
def test_ML_INF_002_scoring_needs_one_full_window_boundary(scoring, rows, has_score):
    result = scoring(normal_telemetry(rows, seed=7))

    assert ("reconstructionError" in result) is has_score


def test_ML_INF_003_healthy_recent_telemetry_is_not_flagged(scoring):
    result = scoring(normal_telemetry(40, seed=21))

    assert result["isAnomaly"] is False
    assert result["reconstructionError"] < result["threshold"]


def test_ML_INF_004_obvious_resource_attack_is_flagged(scoring):
    recent = normal_telemetry(40, seed=21)
    recent.loc[25:, "cpuUsage"] = 99.0
    recent.loc[25:, "networkOut"] *= 200  # e.g. exfiltration
    recent.loc[25:, "processCount"] += 400  # e.g. fork bomb / miner workers

    result = scoring(recent)

    assert result["isAnomaly"] is True


def test_ML_INF_005_incomplete_rows_are_skipped_not_scored(scoring):
    recent = normal_telemetry(40, seed=21)
    recent.loc[39, "networkIn"] = None

    result = scoring(recent)

    assert result["isAnomaly"] is False


class _Identity(torch.nn.Module):
    def forward(self, x):
        return x


@pytest.mark.parametrize(
    "threshold, expected",
    [(0.0, False), (-1e-12, True)],
    ids=["error == threshold -> normal", "error > threshold -> anomaly"],
)
def test_ML_INF_006_threshold_boundary_is_strictly_greater_than(trained_dir, monkeypatch, threshold, expected):
    """An identity 'model' reconstructs perfectly (error == 0), isolating the rule."""
    monkeypatch.setattr(inference, "ARTIFACTS_DIR", str(trained_dir))
    monkeypatch.setattr(inference, "_model_cache", {})
    scaler = inference.load_server_artifacts(SERVER)["scaler"]
    monkeypatch.setattr(inference, "_model_cache", {
        SERVER: {"model": _Identity(), "scaler": scaler, "config": {"anomaly_threshold": threshold}},
    })
    monkeypatch.setattr(inference, "load_metrics_for_server", lambda _id: normal_telemetry(20))

    assert inference.score_server(SERVER)["isAnomaly"] is expected
