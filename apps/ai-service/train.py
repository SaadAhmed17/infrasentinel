import copy
import json
import os

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from model import LSTMAutoencoder

# Absolute, so training reads/writes where inference.py looks, whatever the working directory.
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
WINDOW_SIZE = 20
NUM_FEATURES = 9
HIDDEN_SIZE = 32
EPOCHS = 50
BATCH_SIZE = 32
LEARNING_RATE = 0.001
PATIENCE = 5  # stop early if validation loss doesn't improve for this many epochs in a row
# A window whose reconstruction error is above this percentile of the validation
# (normal) error is an anomaly. 99 keeps the benchmark F1 above 0.85 with a ~1%
# false-positive rate; 95 flagged ~144 normal windows per server per day on the
# team's data (DEF-54, docs/sqa/ML_VALIDATION.md).
THRESHOLD_PERCENTILE = 99


def load_server_sequences(server_id: str):
    server_dir = os.path.join(ARTIFACTS_DIR, server_id)
    train_seq = np.load(os.path.join(server_dir, "train_sequences.npy"))
    val_seq = np.load(os.path.join(server_dir, "val_sequences.npy"))
    return train_seq, val_seq


def train_one_server(server_id: str):
    print(f"\n{'='*60}")
    print(f"Training model for server: {server_id}")
    print(f"{'='*60}")

    train_seq, val_seq = load_server_sequences(server_id)
    if len(train_seq) == 0 or len(val_seq) == 0:
        raise ValueError(
            f"Not enough history to train server {server_id}: {len(train_seq)} training and "
            f"{len(val_seq)} validation windows (need at least one of each) — collect more data first"
        )

    train_tensor = torch.tensor(train_seq, dtype=torch.float32)
    val_tensor = torch.tensor(val_seq, dtype=torch.float32)

    train_loader = DataLoader(TensorDataset(
        train_tensor), batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_tensor),
                            batch_size=BATCH_SIZE, shuffle=False)

    model = LSTMAutoencoder(num_features=NUM_FEATURES,
                            window_size=WINDOW_SIZE, hidden_size=HIDDEN_SIZE)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.MSELoss()

    best_val_loss = float("inf")
    epochs_without_improvement = 0
    best_model_state = None

    for epoch in range(1, EPOCHS + 1):
        model.train()
        train_losses = []
        for (batch,) in train_loader:
            optimizer.zero_grad()
            reconstructed = model(batch)
            loss = loss_fn(reconstructed, batch)
            loss.backward()
            optimizer.step()
            train_losses.append(loss.item())

        model.eval()
        val_losses = []
        with torch.no_grad():
            for (batch,) in val_loader:
                reconstructed = model(batch)
                loss = loss_fn(reconstructed, batch)
                val_losses.append(loss.item())

        avg_train_loss = np.mean(train_losses)
        avg_val_loss = np.mean(val_losses)
        print(
            f"Epoch {epoch:3d}/{EPOCHS} — train_loss: {avg_train_loss:.6f}  val_loss: {avg_val_loss:.6f}")

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            # A real copy: state_dict() shares memory with the live weights, so
            # later epochs would overwrite this "best" snapshot.
            best_model_state = copy.deepcopy(model.state_dict())
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= PATIENCE:
                print(f"Early stopping — no improvement for {PATIENCE} epochs")
                break

    # Restore the best-performing version of the model, not necessarily the last epoch
    model.load_state_dict(best_model_state)

    # Compute the anomaly threshold: reconstruction error on validation (normal) data.
    # Anything reconstructing worse than this, later, is flagged as anomalous.
    model.eval()
    with torch.no_grad():
        val_reconstructed = model(val_tensor)
        per_sequence_error = torch.mean(
            (val_reconstructed - val_tensor) ** 2, dim=(1, 2)).numpy()

    threshold = float(np.percentile(per_sequence_error, THRESHOLD_PERCENTILE))
    print(
        f"Anomaly threshold ({THRESHOLD_PERCENTILE}th percentile of validation reconstruction error): "
        f"{threshold:.6f}")

    server_dir = os.path.join(ARTIFACTS_DIR, server_id)
    torch.save(model.state_dict(), os.path.join(server_dir, "model.pt"))

    with open(os.path.join(server_dir, "config.json"), "w") as f:
        json.dump({
            "window_size": WINDOW_SIZE,
            "num_features": NUM_FEATURES,
            "hidden_size": HIDDEN_SIZE,
            "anomaly_threshold": threshold,
            "best_val_loss": best_val_loss,
        }, f, indent=2)

    print(f"Saved model and config to {server_dir}/")


def train_all_servers() -> dict:
    """Train every pre-processed server; one server's failure must not stop the others.
    Returns {server_id: error message} for the servers that failed."""
    failures = {}
    server_ids = [
        d for d in os.listdir(ARTIFACTS_DIR)
        if os.path.isdir(os.path.join(ARTIFACTS_DIR, d))
    ]
    for server_id in server_ids:
        try:
            train_one_server(server_id)
        except Exception as exc:  # noqa: BLE001 — report and continue with the next server
            failures[server_id] = str(exc)
            print(f"Skipped server {server_id}: {exc}")
    return failures


if __name__ == "__main__":
    train_all_servers()
