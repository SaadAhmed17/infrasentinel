"""Pre-processing tests (ML-PRE-xxx): the data the LSTM learns from.

Pre-processing mistakes are silent: the model still trains, it just learns the
wrong thing or reports optimistic validation results. These tests pin the
properties the design relies on: null handling, the log transform, sliding
windows, a chronological split, and a scaler that never sees validation data.
"""

import pickle

import numpy as np
import pytest
from conftest import normal_telemetry

import preprocess
from data_pipeline import FEATURE_COLUMNS


def test_ML_PRE_001_rows_with_any_missing_feature_are_dropped():
    df = normal_telemetry(10)
    df.loc[3, "networkIn"] = None
    df.loc[7, "loadAverage"] = None

    clean = preprocess.clean_and_transform(df)

    assert len(clean) == 8
    assert not clean[FEATURE_COLUMNS].isnull().any().any()


def test_ML_PRE_002_log_transform_applies_only_to_the_skewed_columns():
    df = normal_telemetry(5)

    clean = preprocess.clean_and_transform(df.copy())

    for col in FEATURE_COLUMNS:
        expected = np.log1p(df[col]) if col in preprocess.SKEWED_COLUMNS else df[col]
        np.testing.assert_allclose(clean[col], expected, err_msg=col)


@pytest.mark.parametrize(
    "rows, expected_sequences",
    [(19, 0), (20, 1), (21, 2), (100, 81)],
    ids=["one short of a window", "exactly one window", "one past", "typical"],
)
def test_ML_PRE_003_sliding_window_count_boundaries(rows, expected_sequences):
    data = np.zeros((rows, 9))

    sequences = preprocess.create_sequences(data, 20)

    assert len(sequences) == expected_sequences
    if expected_sequences:
        assert sequences.shape == (expected_sequences, 20, 9)


def test_ML_PRE_004_windows_slide_one_step_and_preserve_order():
    data = np.arange(30 * 9, dtype=float).reshape(30, 9)

    sequences = preprocess.create_sequences(data, 20)

    np.testing.assert_array_equal(sequences[0], data[0:20])
    np.testing.assert_array_equal(sequences[5], data[5:25])


@pytest.fixture
def processed(tmp_path, monkeypatch):
    """Run the real process_server() into a temp directory; load what it saved."""
    monkeypatch.setattr(preprocess, "ARTIFACTS_DIR", str(tmp_path))

    def run(df, server_id="srv"):
        preprocess.process_server(server_id, df)
        out = tmp_path / server_id
        # Safe: this test just wrote the file itself into its own temp directory.
        with open(out / "scaler.pkl", "rb") as f:
            scaler = pickle.load(f)
        return (np.load(out / "train_sequences.npy"), np.load(out / "val_sequences.npy"), scaler)

    return run


def test_ML_PRE_005_split_is_chronological_last_ten_percent_is_validation(processed):
    df = normal_telemetry(200)

    train, val, scaler = processed(df)

    split = int(200 * preprocess.TRAIN_SPLIT)  # 180
    assert len(train) == split - 20 + 1
    assert len(val) == (200 - split) - 20 + 1
    first_val_row = preprocess.clean_and_transform(df.copy())[FEATURE_COLUMNS].iloc[[split]]
    np.testing.assert_allclose(val[0][0], scaler.transform(first_val_row)[0])


def test_ML_PRE_006_scaler_is_fitted_on_training_data_only_no_leakage(processed):
    df = normal_telemetry(200)
    df.loc[195, "cpuUsage"] = 99.0  # an extreme value that exists ONLY in validation

    _, val, scaler = processed(df)

    cpu = FEATURE_COLUMNS.index("cpuUsage")
    assert scaler.data_max_[cpu] < 99.0, "validation data leaked into the scaler"
    assert val[:, :, cpu].max() > 1.0, "unseen extremes must scale outside [0, 1]"


def test_ML_PRE_007_preprocessing_is_deterministic(processed):
    first = processed(normal_telemetry(150, seed=3), "a")
    second = processed(normal_telemetry(150, seed=3), "b")

    np.testing.assert_array_equal(first[0], second[0])
    np.testing.assert_array_equal(first[1], second[1])


@pytest.mark.xfail(strict=True, reason="DEF-37: training writes artifacts relative to the working directory")
def test_ML_PRE_008_training_and_inference_agree_on_artifact_location(tmp_path, monkeypatch):
    import os

    import inference

    monkeypatch.chdir(tmp_path)  # e.g. running the training script from the repo root

    assert os.path.abspath(preprocess.ARTIFACTS_DIR) == inference.ARTIFACTS_DIR
