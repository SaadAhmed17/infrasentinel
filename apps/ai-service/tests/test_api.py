"""FastAPI contract tests for the AI service (AI-API-xxx)."""

import pytest
from fastapi.testclient import TestClient

import inference
import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(inference, "ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setattr(inference, "_model_cache", {})
    return TestClient(main.app)


def test_AI_API_001_health_endpoint(client):
    assert client.get("/health").json() == {"status": "ok", "service": "ai-service"}


@pytest.mark.parametrize(
    "body",
    [{}, {"question": "q"}, {"organizationId": "org-A"}, {"organizationId": 1, "question": ["q"]}],
    ids=["empty", "missing org", "missing question", "wrong types"],
)
def test_AI_API_002_malformed_rag_requests_are_rejected_with_422(client, body):
    assert client.post("/rag/query", json=body).status_code == 422


def test_AI_API_003_anomaly_score_for_an_untrained_server_is_an_explained_error(client):
    response = client.get("/anomaly-score/no-such-server")

    assert response.status_code == 200
    assert "No trained model" in response.json()["error"]


@pytest.mark.xfail(strict=True, reason="DEF-24: the AI service trusts any caller and any organizationId")
def test_AI_API_004_rag_endpoints_require_service_authentication(client, monkeypatch):
    # main.py imported the function by name, so it must be replaced on `main`.
    monkeypatch.setattr(main, "query_incidents", lambda org, q: {"answer": "data of " + org, "sources": []})

    response = client.post("/rag/query", json={"organizationId": "any-org-i-like", "question": "dump"})

    assert response.status_code in (401, 403)
