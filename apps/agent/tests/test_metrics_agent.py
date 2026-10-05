"""Metrics agent tests (AGENT-MET-xxx).

psutil and the clock are replaced with controlled values so the calculations are
checked exactly. The payload is also checked against the backend's validation
rules (IngestMetricDto): a payload the API would reject is a lost heartbeat.
"""

from types import SimpleNamespace

import pytest
import requests


def fake_host(monkeypatch, agent, *, net=(1_000, 2_000), disk=(10_000, 20_000), system="Linux"):
    ps = agent.psutil
    monkeypatch.setattr(ps, "cpu_percent", lambda interval: 37.5)
    monkeypatch.setattr(ps, "virtual_memory", lambda: SimpleNamespace(percent=61.2))
    monkeypatch.setattr(ps, "disk_usage", lambda path: SimpleNamespace(percent=73.0, path=path))
    monkeypatch.setattr(ps, "pids", lambda: list(range(250)))
    monkeypatch.setattr(ps, "net_io_counters", lambda: SimpleNamespace(bytes_recv=net[0], bytes_sent=net[1]))
    monkeypatch.setattr(
        ps, "disk_io_counters",
        lambda: SimpleNamespace(read_bytes=disk[0], write_bytes=disk[1]) if disk else None,
    )
    monkeypatch.setattr(agent.platform, "system", lambda: system)
    monkeypatch.setattr(agent.os, "getloadavg", lambda: (1.5, 1.0, 0.5), raising=False)


def set_clock(monkeypatch, agent, seconds):
    monkeypatch.setattr(agent.time, "time", lambda: seconds)


def assert_accepted_by_api(payload):
    """Mirror of the API's IngestMetricDto rules."""
    for field in ("cpuUsage", "memUsage", "diskUsage"):
        assert 0 <= payload[field] <= 100, field
    for field in ("networkIn", "networkOut", "diskReadRate", "diskWriteRate", "loadAverage"):
        if field in payload:
            assert payload[field] >= 0, f"{field}={payload[field]} would be rejected"
    assert isinstance(payload["processCount"], int) and payload["processCount"] >= 0


def test_AGENT_MET_001_first_sample_has_gauges_but_no_rates(agent_module, monkeypatch):
    fake_host(monkeypatch, agent_module)
    set_clock(monkeypatch, agent_module, 100.0)

    payload = agent_module.collect_metrics()

    assert payload == {
        "cpuUsage": 37.5, "memUsage": 61.2, "diskUsage": 73.0,
        "processCount": 250, "loadAverage": 1.5,
    }
    assert_accepted_by_api(payload)


def test_AGENT_MET_002_rates_are_bytes_per_second_between_samples(agent_module, monkeypatch):
    fake_host(monkeypatch, agent_module, net=(1_000, 2_000), disk=(10_000, 20_000))
    set_clock(monkeypatch, agent_module, 100.0)
    agent_module.collect_metrics()

    fake_host(monkeypatch, agent_module, net=(21_000, 7_000), disk=(30_000, 20_000))
    set_clock(monkeypatch, agent_module, 110.0)
    payload = agent_module.collect_metrics()

    assert payload["networkIn"] == 2_000.0
    assert payload["networkOut"] == 500.0
    assert payload["diskReadRate"] == 2_000.0
    assert payload["diskWriteRate"] == 0.0
    assert_accepted_by_api(payload)


def test_AGENT_MET_003_windows_host_omits_load_average_and_checks_drive_c(agent_module, monkeypatch):
    fake_host(monkeypatch, agent_module, system="Windows")
    seen_paths = []
    monkeypatch.setattr(
        agent_module.psutil, "disk_usage",
        lambda path: seen_paths.append(path) or SimpleNamespace(percent=10.0),
    )

    payload = agent_module.collect_metrics()

    assert "loadAverage" not in payload
    assert seen_paths == ["C:\\"]


def test_AGENT_MET_004_host_without_disk_counters_still_reports(agent_module, monkeypatch):
    fake_host(monkeypatch, agent_module, disk=None)
    set_clock(monkeypatch, agent_module, 100.0)
    agent_module.collect_metrics()
    set_clock(monkeypatch, agent_module, 110.0)

    payload = agent_module.collect_metrics()

    assert "diskReadRate" not in payload and "networkIn" in payload


@pytest.mark.xfail(strict=True, reason="DEF-35: counter reset produces a negative rate the API rejects")
def test_AGENT_MET_005_counter_reset_never_produces_a_rejected_payload(agent_module, monkeypatch):
    fake_host(monkeypatch, agent_module, net=(9_000_000, 9_000_000))
    set_clock(monkeypatch, agent_module, 100.0)
    agent_module.collect_metrics()

    fake_host(monkeypatch, agent_module, net=(500, 500))  # interface reset / reboot
    set_clock(monkeypatch, agent_module, 110.0)
    payload = agent_module.collect_metrics()

    assert_accepted_by_api(payload)


class _Response:
    def __init__(self, status):
        self.status = status

    def raise_for_status(self):
        if self.status >= 400:
            raise requests.HTTPError(f"{self.status} Client Error")


def test_AGENT_MET_010_push_sends_key_header_and_bounded_timeout(agent_module, monkeypatch):
    calls = []
    monkeypatch.setattr(
        agent_module.requests, "post",
        lambda url, json, headers, timeout: calls.append((url, headers, timeout)) or _Response(201),
    )

    agent_module.push_metrics({"cpuUsage": 1, "memUsage": 1, "diskUsage": 1})

    assert calls == [("http://api.test/agent/metrics", {"x-api-key": "isk_test_key"}, 5)]


@pytest.mark.parametrize(
    "failure",
    [requests.ConnectionError("refused"), requests.Timeout("slow")],
    ids=["API down", "API timeout"],
)
def test_AGENT_MET_011_network_failures_are_logged_not_fatal(agent_module, monkeypatch, capsys, failure):
    def boom(*args, **kwargs):
        raise failure

    monkeypatch.setattr(agent_module.requests, "post", boom)

    agent_module.push_metrics({"cpuUsage": 1})

    assert "[ERROR]" in capsys.readouterr().out


def test_AGENT_MET_012_rejected_key_is_reported(agent_module, monkeypatch, capsys):
    monkeypatch.setattr(agent_module.requests, "post", lambda *a, **k: _Response(401))

    agent_module.push_metrics({"cpuUsage": 1})

    assert "401" in capsys.readouterr().out


def test_AGENT_MET_013_agent_refuses_to_start_without_an_api_key(monkeypatch):
    import importlib
    import sys

    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.setattr(sys, "argv", ["agent.py", "no-such.env"])
    sys.modules.pop("agent", None)

    with pytest.raises(SystemExit, match="API_KEY"):
        importlib.import_module("agent")
