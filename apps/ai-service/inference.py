import json
import os
import pickle

import numpy as np
import torch

from data_pipeline import FEATURE_COLUMNS, load_metrics_for_server
from model import LSTMAutoencoder
from preprocess import SKEWED_COLUMNS, WINDOW_SIZE

ARTIFACTS_DIR = os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "artifacts")

# Cache loaded models/scalers in memory so we don't reload from disk on every single request
_model_cache = {}


def load_server_artifacts(server_id: str):
    """Load (and cache) a server's trained model, scaler, and config."""
    if server_id in _model_cache:
        return _model_cache[server_id]

    server_dir = os.path.join(ARTIFACTS_DIR, server_id)

    if not os.path.exists(server_dir):
        return None  # this server has never been trained on — no model exists yet

    with open(os.path.join(server_dir, "config.json")) as f:
        config = json.load(f)

    model = LSTMAutoencoder(
        num_features=config["num_features"],
        window_size=config["window_size"],
        hidden_size=config["hidden_size"],
    )
    model.load_state_dict(torch.load(os.path.join(server_dir, "model.pt")))
    model.eval()

    with open(os.path.join(server_dir, "scaler.pkl"), "rb") as f:
        scaler = pickle.load(f)

    artifacts = {"model": model, "scaler": scaler, "config": config}
    _model_cache[server_id] = artifacts
    return artifacts


def score_server(server_id: str):
    """
    Pull this server's most recent WINDOW_SIZE readings, run them through its trained
    model, and return an anomaly score + whether it crosses that server's threshold.
    """
    artifacts = load_server_artifacts(server_id)
    if artifacts is None:
        return {"error": f"No trained model exists for server {server_id}"}

    df = load_metrics_for_server(server_id)
    df = df.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)

    if len(df) < WINDOW_SIZE:
        return {"error": f"Not enough recent data — need {WINDOW_SIZE} readings, have {len(df)}"}

    recent_window = df.tail(WINDOW_SIZE).copy()

    for col in SKEWED_COLUMNS:
        recent_window[col] = np.log1p(recent_window[col])

    scaled = artifacts["scaler"].transform(recent_window[FEATURE_COLUMNS])
    sequence = torch.tensor(scaled, dtype=torch.float32).unsqueeze(
        0)  # add batch dimension: (1, 20, 9)

    with torch.no_grad():
        reconstructed = artifacts["model"](sequence)
        error = torch.mean((reconstructed - sequence) ** 2).item()

    threshold = artifacts["config"]["anomaly_threshold"]
    is_anomaly = error > threshold

    return {
        "serverId": server_id,
        "reconstructionError": round(error, 6),
        "threshold": round(threshold, 6),
        "isAnomaly": is_anomaly,
        "windowSize": WINDOW_SIZE,
    }
