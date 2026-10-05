import importlib
import os
import sys

import pytest

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, AGENT_DIR)


@pytest.fixture
def agent_module(monkeypatch):
    """Import agent.py fresh with a known configuration.

    agent.py reads its config at import time (and exits without API_KEY), and it
    treats sys.argv[1] as an .env path — so both are pinned before importing.
    """
    monkeypatch.setenv("API_KEY", "isk_test_key")
    monkeypatch.setenv("API_URL", "http://api.test")
    monkeypatch.setattr(sys, "argv", ["agent.py", os.path.join(AGENT_DIR, "missing.env")])
    sys.modules.pop("agent", None)
    return importlib.import_module("agent")


@pytest.fixture
def ssh_agent(monkeypatch):
    monkeypatch.setenv("API_KEY", "isk_test_key")
    monkeypatch.setenv("API_URL", "http://api.test")
    sys.modules.pop("ssh_log_agent", None)
    return importlib.import_module("ssh_log_agent")
