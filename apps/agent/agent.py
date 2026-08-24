import os
import sys
import time
import platform
import psutil
import requests
from dotenv import load_dotenv

env_file = sys.argv[1] if len(sys.argv) > 1 else ".env"
load_dotenv(dotenv_path=env_file)

API_URL = os.getenv("API_URL", "http://localhost:3001")
API_KEY = os.getenv("API_KEY")
PUSH_INTERVAL = int(os.getenv("PUSH_INTERVAL_SECONDS", "10"))

if not API_KEY:
    raise SystemExit("API_KEY is not set in .env — cannot start agent")

# Track previous cumulative counters so we can calculate rates (bytes/sec) between pushes
_previous_net = None
_previous_disk_io = None
_previous_sample_time = None


def get_load_average():
    """Linux/Unix load average — not available on Windows, returns None there instead of crashing."""
    if platform.system() == "Windows":
        return None
    try:
        one_min, _, _ = os.getloadavg()
        return round(one_min, 2)
    except (OSError, AttributeError):
        return None


def collect_metrics():
    global _previous_net, _previous_disk_io, _previous_sample_time

    now = time.time()
    current_net = psutil.net_io_counters()
    current_disk_io = psutil.disk_io_counters()

    metrics = {
        "cpuUsage": psutil.cpu_percent(interval=1),
        "memUsage": psutil.virtual_memory().percent,
        "diskUsage": psutil.disk_usage("/" if platform.system() != "Windows" else "C:\\").percent,
        "processCount": len(psutil.pids()),
        "loadAverage": get_load_average(),
    }

    # Rates require two samples — skip on the very first run since there's nothing to compare against yet
    if _previous_net is not None and _previous_sample_time is not None:
        elapsed = now - _previous_sample_time
        if elapsed > 0:
            metrics["networkIn"] = round(
                (current_net.bytes_recv - _previous_net.bytes_recv) / elapsed, 2)
            metrics["networkOut"] = round(
                (current_net.bytes_sent - _previous_net.bytes_sent) / elapsed, 2)

            if current_disk_io and _previous_disk_io:
                metrics["diskReadRate"] = round(
                    (current_disk_io.read_bytes - _previous_disk_io.read_bytes) / elapsed, 2)
                metrics["diskWriteRate"] = round(
                    (current_disk_io.write_bytes - _previous_disk_io.write_bytes) / elapsed, 2)

    _previous_net = current_net
    _previous_disk_io = current_disk_io
    _previous_sample_time = now

    # Remove keys with None values — don't send nulls explicitly, just omit them (DTO treats missing the same as null)
    return {k: v for k, v in metrics.items() if v is not None}


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
