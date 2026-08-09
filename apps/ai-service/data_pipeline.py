import os
import psycopg2
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# The 9 features our LSTM-Autoencoder will eventually learn from
FEATURE_COLUMNS = [
    "cpuUsage",
    "memUsage",
    "diskUsage",
    "networkIn",
    "networkOut",
    "diskReadRate",
    "diskWriteRate",
    "processCount",
    "loadAverage",
]


def get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def load_metrics_for_server(server_id: str) -> pd.DataFrame:
    """Pull all metrics for one server, ordered by time — the raw material for training."""
    conn = get_connection()
    columns_sql = ", ".join(f'"{c}"' for c in FEATURE_COLUMNS)
    query = f"""
        SELECT {columns_sql}, "timestamp"
        FROM "Metric"
        WHERE "serverId" = %s
        ORDER BY "timestamp" ASC
    """
    df = pd.read_sql(query, conn, params=(server_id,))
    conn.close()
    return df


def load_all_servers() -> dict:
    """Pull metrics for every server that has data, keyed by serverId — useful for training across multiple servers."""
    conn = get_connection()
    server_ids = pd.read_sql('SELECT DISTINCT "serverId" FROM "Metric"', conn)[
        "serverId"].tolist()
    conn.close()

    return {sid: load_metrics_for_server(sid) for sid in server_ids}


if __name__ == "__main__":
    all_data = load_all_servers()
    for server_id, df in all_data.items():
        print(f"\nServer {server_id}: {len(df)} rows")
        print(df[FEATURE_COLUMNS].describe())
        null_counts = df[FEATURE_COLUMNS].isnull().sum()
        print(f"Null counts per column:\n{null_counts}")
