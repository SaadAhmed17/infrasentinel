import os
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:3001")
API_KEY = os.getenv("API_KEY")
AUTH_LOG_PATH = "/var/log/auth.log"

SUDO_PATTERN = re.compile(r"sudo:\s+(\S+)\s*:.*COMMAND=(.+)")
FAILED_PATTERN = re.compile(
    r"Failed password for (invalid user )?(\S+) from (\S+)")
ACCEPTED_PATTERN = re.compile(r"Accepted password for (\S+) from (\S+)")


def push_event(outcome, username, ip_address):
    try:
        response = requests.post(
            f"{API_URL}/agent/log-event",
            json={
                "eventType": "SSH_LOGIN_FAILURE" if outcome == "FAILURE" else "SSH_LOGIN_SUCCESS",
                "outcome": outcome,
                "username": username,
                "ipAddress": ip_address,
            },
            headers={"x-api-key": API_KEY},
            timeout=5,
        )
        response.raise_for_status()
        print(f"[OK] Pushed SSH {outcome}: user={username} ip={ip_address}")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to push SSH event: {e}")


def push_sudo_event(username, command):
    try:
        response = requests.post(
            f"{API_URL}/agent/log-event",
            json={
                "eventType": "SUDO_COMMAND",
                "outcome": "SUCCESS",
                "username": username,
                "ipAddress": "local",
                "command": command.strip(),
            },
            headers={"x-api-key": API_KEY},
            timeout=5,
        )
        response.raise_for_status()
        print(
            f"[OK] Pushed sudo command: user={username} cmd={command.strip()}")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to push sudo event: {e}")


def tail_auth_log():
    with open(AUTH_LOG_PATH, "r") as f:
        # start reading only NEW lines, not the entire existing file history
        f.seek(0, os.SEEK_END)

        while True:
            line = f.readline()
            if not line:
                time.sleep(1)
                continue

            failed_match = FAILED_PATTERN.search(line)
            if failed_match:
                username = failed_match.group(2)
                ip = failed_match.group(3)
                push_event("FAILURE", username, ip)
                continue

            accepted_match = ACCEPTED_PATTERN.search(line)
            if accepted_match:
                username = accepted_match.group(1)
                ip = accepted_match.group(2)
                push_event("SUCCESS", username, ip)

            sudo_match = SUDO_PATTERN.search(line)
            if sudo_match:
                push_sudo_event(sudo_match.group(1), sudo_match.group(2))
                continue


if __name__ == "__main__":
    if not API_KEY:
        raise SystemExit("API_KEY not set in .env")
    print(f"Watching {AUTH_LOG_PATH} for SSH auth events...")
    tail_auth_log()
