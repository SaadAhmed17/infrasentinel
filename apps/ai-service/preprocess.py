import os
import pickle
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from data_pipeline import load_all_servers, FEATURE_COLUMNS

# Columns that are heavily right-skewed (mostly near 0, occasional huge spikes) — these get log-transformed
SKEWED_COLUMNS = ["networkIn", "networkOut", "diskReadRate", "diskWriteRate"]

# how many consecutive readings form one "sequence" (~200 seconds of history)
WINDOW_SIZE = 20
# 90% of each server's timeline used for training, last 10% held out for validation
TRAIN_SPLIT = 0.9

ARTIFACTS_DIR = "artifacts"


def clean_and_transform(df):
    """Drop nulls, log-transform skewed columns. Returns a clean DataFrame ready for scaling."""
    df = df.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)

    for col in SKEWED_COLUMNS:
        # log1p = log(1 + x), safely handles zero values
        df[col] = np.log1p(df[col])

    return df


def create_sequences(data: np.ndarray, window_size: int) -> np.ndarray:
    """
    Slide a window of `window_size` steps across the data, one step at a time.
    Turns a flat (num_rows, num_features) array into (num_sequences, window_size, num_features)
    — the 3D shape an LSTM expects: (batch, time_steps, features).
    """
    sequences = []
    for i in range(len(data) - window_size + 1):
        sequences.append(data[i: i + window_size])
    return np.array(sequences)


def process_server(server_id: str, df):
    print(f"\nProcessing server {server_id}...")
    print(f"  Raw rows: {len(df)}")

    df = clean_and_transform(df)
    print(f"  After dropping nulls: {len(df)}")

    # Chronological split — NOT random shuffling — because this is time-series data.
    # We want to validate on "the most recent period" as a realistic test of "does this
    # generalize to new, unseen time," not randomly scattered points from the middle of training data.
    split_index = int(len(df) * TRAIN_SPLIT)
    train_df = df.iloc[:split_index]
    val_df = df.iloc[split_index:]

    # Fit the scaler ONLY on training data — this is important. If we fit on all data
    # (including validation), information from the "future" (validation period) would
    # leak into how we scale the training data, making our validation results overly optimistic.
    scaler = MinMaxScaler()
    train_scaled = scaler.fit_transform(train_df[FEATURE_COLUMNS])
    val_scaled = scaler.transform(val_df[FEATURE_COLUMNS])

    train_sequences = create_sequences(train_scaled, WINDOW_SIZE)
    val_sequences = create_sequences(val_scaled, WINDOW_SIZE)

    print(f"  Train sequences: {train_sequences.shape}")
    print(f"  Val sequences:   {val_sequences.shape}")

    # Save everything this server needs for training and later inference
    server_dir = os.path.join(ARTIFACTS_DIR, server_id)
    os.makedirs(server_dir, exist_ok=True)

    np.save(os.path.join(server_dir, "train_sequences.npy"), train_sequences)
    np.save(os.path.join(server_dir, "val_sequences.npy"), val_sequences)

    with open(os.path.join(server_dir, "scaler.pkl"), "wb") as f:
        pickle.dump(scaler, f)

    print(f"  Saved to {server_dir}/")


if __name__ == "__main__":
    all_data = load_all_servers()
    for server_id, df in all_data.items():
        process_server(server_id, df)
