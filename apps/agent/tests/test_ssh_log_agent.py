"""SSH / sudo log-parsing tests (AGENT-SSH-xxx).

The real tail_auth_log() loop is exercised unmodified: only its I/O is replaced
(the log file, the network push functions, and sleep). Sample lines use the
formats sshd/sudo actually write to /var/log/auth.log, including the RFC 3339
timestamps used by newer Ubuntu releases — similar in spirit to replaying log
samples through a SIEM decoder (e.g. wazuh-logtest).
"""

import io

import pytest
import requests


class _EndOfLog(Exception):
    """Raised by the fake sleep() once all sample lines have been consumed."""


def parse(ssh_agent, monkeypatch, lines):
    """Run the real tailing loop over `lines`; return what it would have pushed."""
    pushed = []
    monkeypatch.setattr(
        ssh_agent, "push_event",
        lambda outcome, user, ip: pushed.append(("SSH", outcome, user, ip)),
    )
    monkeypatch.setattr(
        ssh_agent, "push_sudo_event",
        lambda outcome, user, cmd: pushed.append(("SUDO", outcome, user, cmd.strip())),
    )

    def fake_sleep(_seconds):
        raise _EndOfLog

    monkeypatch.setattr(ssh_agent.time, "sleep", fake_sleep)
    fake_log = io.StringIO("".join(line + "\n" for line in lines))
    fake_log.seek = lambda *args: 0  # the agent seeks to EOF; start at our lines instead
    monkeypatch.setattr("builtins.open", lambda *args, **kwargs: fake_log)

    with pytest.raises(_EndOfLog):
        ssh_agent.tail_auth_log()
    return pushed


SSHD = "Sep 29 10:15:01 web-01 sshd[1234]: "


@pytest.mark.parametrize(
    "line, expected",
    [
        pytest.param(
            SSHD + "Failed password for root from 203.0.113.5 port 52814 ssh2",
            ("SSH", "FAILURE", "root", "203.0.113.5"),
            id="AGENT-SSH-001 failed password",
        ),
        pytest.param(
            SSHD + "Failed password for invalid user admin from 203.0.113.5 port 52816 ssh2",
            ("SSH", "FAILURE", "admin", "203.0.113.5"),
            id="AGENT-SSH-002 failed password for a non-existent user",
        ),
        pytest.param(
            SSHD + "Accepted password for hashim from 198.51.100.4 port 50022 ssh2",
            ("SSH", "SUCCESS", "hashim", "198.51.100.4"),
            id="AGENT-SSH-003 accepted password",
        ),
        pytest.param(
            SSHD + "Failed password for root from 2001:db8::1 port 22 ssh2",
            ("SSH", "FAILURE", "root", "2001:db8::1"),
            id="AGENT-SSH-004 IPv6 source address",
        ),
        pytest.param(
            "2026-09-29T10:15:01.123456+00:00 web-01 sshd[1234]: "
            "Failed password for root from 203.0.113.5 port 52814 ssh2",
            ("SSH", "FAILURE", "root", "203.0.113.5"),
            id="AGENT-SSH-005 RFC3339 timestamp format (Ubuntu 24.04)",
        ),
        pytest.param(
            "Sep 29 10:20:00 web-01 sudo:   hashim : TTY=pts/0 ; PWD=/home/hashim ; "
            "USER=root ; COMMAND=/usr/bin/apt update",
            ("SUDO", "SUCCESS", "hashim", "/usr/bin/apt update"),
            id="AGENT-SSH-006 sudo command with arguments",
        ),
    ],
)
def test_recognised_security_lines(ssh_agent, monkeypatch, line, expected):
    assert parse(ssh_agent, monkeypatch, [line]) == [expected]


@pytest.mark.parametrize(
    "line",
    [
        pytest.param(SSHD + "Connection closed by 203.0.113.5 port 52814 [preauth]", id="connection closed"),
        pytest.param(SSHD + "pam_unix(sshd:session): session opened for user hashim(uid=1000)", id="PAM session"),
        pytest.param("Sep 29 10:17:01 web-01 CRON[999]: pam_unix(cron:session): session closed for user root", id="cron"),
        pytest.param("", id="empty line"),
        pytest.param(SSHD + "Failed password for", id="truncated line"),
        pytest.param("\x00\x01\x02 garbage \xff", id="binary garbage"),
    ],
)
def test_AGENT_SSH_010_noise_and_malformed_lines_are_ignored_without_crashing(ssh_agent, monkeypatch, line):
    assert parse(ssh_agent, monkeypatch, [line]) == []


def test_AGENT_SSH_011_a_burst_is_reported_line_by_line_in_order(ssh_agent, monkeypatch):
    burst = [SSHD + f"Failed password for root from 203.0.113.{i} port 22 ssh2" for i in range(1, 6)]

    pushed = parse(ssh_agent, monkeypatch, burst)

    assert [p[3] for p in pushed] == [f"203.0.113.{i}" for i in range(1, 6)]


@pytest.mark.parametrize(
    "refusal",
    ["3 incorrect password attempts", "user NOT in sudoers", "command not allowed"],
)
def test_AGENT_SSH_020_refused_sudo_attempt_is_reported_as_a_failure_not_executed(ssh_agent, monkeypatch, refusal):
    line = (
        f"Sep 29 10:21:00 web-01 sudo:  mallory : {refusal} ; "
        "TTY=pts/1 ; PWD=/home/mallory ; USER=root ; COMMAND=/bin/cat /etc/shadow"
    )

    pushed = parse(ssh_agent, monkeypatch, [line])

    assert pushed == [("SUDO", "FAILURE", "mallory", "/bin/cat /etc/shadow")]


@pytest.mark.xfail(strict=True, reason="DEF-29: key-based SSH logins are not detected")
def test_AGENT_SSH_021_public_key_login_is_reported(ssh_agent, monkeypatch):
    line = SSHD + "Accepted publickey for hashim from 198.51.100.4 port 50022 ssh2: ED25519 SHA256:abc"

    assert parse(ssh_agent, monkeypatch, [line]) == [("SSH", "SUCCESS", "hashim", "198.51.100.4")]


@pytest.mark.xfail(strict=True, reason="DEF-29: failed key-based SSH logins are not detected")
def test_AGENT_SSH_022_failed_public_key_attempt_is_reported(ssh_agent, monkeypatch):
    line = SSHD + "Failed publickey for root from 203.0.113.5 port 52814 ssh2: RSA SHA256:xyz"

    assert parse(ssh_agent, monkeypatch, [line]) == [("SSH", "FAILURE", "root", "203.0.113.5")]


# --- what goes over the wire -------------------------------------------------

class _Recorder:
    def __init__(self, response=None, error=None):
        self.calls, self.response, self.error = [], response, error

    def __call__(self, url, json, headers, timeout):
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        if self.error:
            raise self.error
        return self.response


class _Ok:
    def raise_for_status(self):
        return None


def test_AGENT_SSH_030_ssh_event_payload_matches_the_api_contract(ssh_agent, monkeypatch):
    rec = _Recorder(response=_Ok())
    monkeypatch.setattr(ssh_agent.requests, "post", rec)

    ssh_agent.push_event("FAILURE", "root", "203.0.113.5")

    (call,) = rec.calls
    assert call["url"] == "http://api.test/agent/log-event"
    assert call["headers"] == {"x-api-key": "isk_test_key"}
    assert call["json"] == {
        "eventType": "SSH_LOGIN_FAILURE", "outcome": "FAILURE",
        "username": "root", "ipAddress": "203.0.113.5",
    }
    assert call["timeout"] == 5


def test_AGENT_SSH_031_sudo_payload_marks_the_source_as_local(ssh_agent, monkeypatch):
    rec = _Recorder(response=_Ok())
    monkeypatch.setattr(ssh_agent.requests, "post", rec)

    ssh_agent.push_sudo_event("SUCCESS", "hashim", "  /usr/bin/id  ")
    ssh_agent.push_sudo_event("FAILURE", "mallory", "/bin/cat /etc/shadow")

    assert [c["json"] for c in rec.calls] == [
        {
            "eventType": "SUDO_COMMAND", "outcome": "SUCCESS",
            "username": "hashim", "ipAddress": "local", "command": "/usr/bin/id",
        },
        {
            "eventType": "SUDO_COMMAND", "outcome": "FAILURE",
            "username": "mallory", "ipAddress": "local", "command": "/bin/cat /etc/shadow",
        },
    ]


def test_AGENT_SSH_032_an_unreachable_api_does_not_crash_the_agent(ssh_agent, monkeypatch, capsys):
    monkeypatch.setattr(ssh_agent.requests, "post", _Recorder(error=requests.ConnectionError("down")))

    ssh_agent.push_event("FAILURE", "root", "203.0.113.5")

    assert "[ERROR]" in capsys.readouterr().out
