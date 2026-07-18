import os
import time
import psutil
import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:3001")
API_KEY = os.getenv("API_KEY")
PUSH_INTERVAL = int(os.getenv("PUSH_INTERVAL_SECONDS", "10"))

if not API_KEY:
    raise SystemExit("API_KEY is not set in .env — cannot start agent")


def collect_metrics():
    return {
        "cpuUsage": psutil.cpu_percent(interval=1),
        "memUsage": psutil.virtual_memory().percent,
        "diskUsage": psutil.disk_usage("/").percent,
    }


def push_metrics(metrics: dict):
    try:
        response = requests.post(
            f"{API_URL}/agent/metrics",
            json=metrics,
            headers={"x-api-key": API_KEY},
            timeout=5,
        )
        response.raise_for_status()
        print(f"[OK] Pushed metrics: {metrics}")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to push metrics: {e}")


def main():
    print(
        f"InfraSentinel Agent starting — pushing to {API_URL} every {PUSH_INTERVAL}s")
    while True:
        metrics = collect_metrics()
        push_metrics(metrics)
        time.sleep(PUSH_INTERVAL)


if __name__ == "__main__":
    main()
