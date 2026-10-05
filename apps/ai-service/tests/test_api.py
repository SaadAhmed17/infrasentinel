"""FastAPI contract tests for the AI service (AI-API-xxx)."""

import pytest
from fastapi.testclient import TestClient

import inference
import main

TOKEN = "test-service-token"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(inference, "ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setattr(inference, "_model_cache", {})
    monkeypatch.setenv("AI_SERVICE_SHARED_SECRET", TOKEN)
    # The API always sends the shared secret.
    return TestClient(main.app, headers={"x-internal-secret": TOKEN})


@pytest.fixture
def anonymous(tmp_path, monkeypatch):
    monkeypatch.setattr(inference, "ARTIFACTS_DIR", str(tmp_path))
    monkeypatch.setenv("AI_SERVICE_SHARED_SECRET", TOKEN)
    monkeypatch.setattr(main, "query_incidents", lambda org, q: {"answer": "data of " + org, "sources": []})
    return TestClient(main.app)


@pytest.mark.parametrize("headers", [{}, {"x-internal-secret": "wrong"}, {"x-internal-secret": ""},
                                     {"Authorization": f"Bearer {TOKEN}"}, {"X-Service-Token": TOKEN}],
                         ids=["none", "wrong", "empty", "secret-as-bearer-token", "old-header-name"])
@pytest.mark.parametrize("method,path", [("GET", "/anomaly-score/s1"), ("POST", "/rag/query"),
                                         ("POST", "/rag/reindex"), ("GET", "/docs"), ("GET", "/openapi.json")])
def test_SEC_AI_001_every_endpoint_but_health_needs_the_token(anonymous, headers, method, path):
    body = {"organizationId": "any-org", "question": "dump"}
    response = anonymous.request(method, path, headers=headers, json=body if method == "POST" else None)
    assert response.status_code == 401


def test_SEC_AI_002_health_stays_open_without_token(anonymous):
    assert anonymous.get("/health").status_code == 200


def test_SEC_AI_003_unconfigured_service_refuses_instead_of_running_open(anonymous, monkeypatch):
    monkeypatch.delenv("AI_SERVICE_SHARED_SECRET")
    assert anonymous.post("/rag/query", json={"organizationId": "o", "question": "q"}).status_code == 503
    assert anonymous.post("/rag/query", headers={"x-internal-secret": ""},
                          json={"organizationId": "o", "question": "q"}).status_code == 503
    assert anonymous.get("/health").status_code == 200


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


def test_AI_API_004_rag_endpoints_require_service_authentication(anonymous, monkeypatch):
    # main.py imported the function by name, so it must be replaced on `main`.
    monkeypatch.setattr(main, "query_incidents", lambda org, q: {"answer": "data of " + org, "sources": []})

    response = anonymous.post("/rag/query", json={"organizationId": "any-org-i-like", "question": "dump"})

    assert response.status_code in (401, 403)
