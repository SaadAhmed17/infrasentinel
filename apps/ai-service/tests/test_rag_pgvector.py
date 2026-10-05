"""RAG tenant-isolation tests against a real PostgreSQL + pgvector database (RAG-Ixx).

Requirement (README): retrieval is "filtered by organization within the same SQL
query, so one tenant's incidents are never retrievable by another".

Adversarial design: Org B's incident embedding is made IDENTICAL to the question's
embedding, so it is the single nearest vector in the whole table. If the org
filter were missing or wrong anywhere, it would be the first result for Org A.
"""

import uuid

import psycopg2
import pytest
from conftest import FakeEmbedder

import rag

pytestmark = pytest.mark.integration

QUESTION = "Was there a credential stuffing attack on the payroll portal?"


def vector_literal(vec):
    return "[" + ",".join(f"{x:.8f}" for x in vec) + "]"


@pytest.fixture
def two_orgs(pg_url, monkeypatch, fake_llm):
    monkeypatch.setattr(rag, "DATABASE_URL", pg_url)
    conn = psycopg2.connect(pg_url)
    cur = conn.cursor()
    cur.execute('TRUNCATE "IncidentEmbedding", "Alert", "Incident", "Rule", "Server", "Organization" CASCADE')

    ids = {k: str(uuid.uuid4()) for k in ("orgA", "orgB", "a1", "a2", "b1", "ruleA", "serverA")}
    cur.execute('INSERT INTO "Organization" (id, name) VALUES (%s, %s), (%s, %s)',
                (ids["orgA"], "Alpha", ids["orgB"], "Bravo"))
    incidents = [
        (ids["a1"], "Disk almost full on web-01", ids["orgA"]),
        (ids["a2"], "Heartbeat missing from db-02", ids["orgA"]),
        (ids["b1"], "Credential stuffing against payroll portal [BRAVO-CONFIDENTIAL]", ids["orgB"]),
    ]
    for incident_id, title, org in incidents:
        cur.execute(
            'INSERT INTO "Incident" (id, title, severity, "organizationId") VALUES (%s, %s, %s, %s)',
            (incident_id, title, "HIGH", org),
        )
    cur.execute('INSERT INTO "Server" (id, name, "apiKey", "organizationId") VALUES (%s, %s, %s, %s)',
                (ids["serverA"], "web-01", "isk_test_rag", ids["orgA"]))
    cur.execute(
        'INSERT INTO "Rule" (id, name, "ruleType", "organizationId") VALUES (%s, %s, %s, %s)',
        (ids["ruleA"], "disk > 90%", "METRIC_THRESHOLD", ids["orgA"]),
    )
    cur.execute(
        'INSERT INTO "Alert" (id, "ruleId", "serverId", details, "incidentId") VALUES (%s, %s, %s, %s, %s)',
        (str(uuid.uuid4()), ids["ruleA"], ids["serverA"], '{"value": 97}', ids["a1"]),
    )

    embedder = FakeEmbedder()
    vectors = {
        ids["a1"]: embedder.encode("disk incident"),
        ids["a2"]: embedder.encode("heartbeat incident"),
        ids["b1"]: embedder.encode(QUESTION),  # the perfect match — but it belongs to Org B
    }
    for incident_id, title, org in incidents:
        cur.execute(
            'INSERT INTO "IncidentEmbedding" (id, "incidentId", "organizationId", content, embedding) '
            "VALUES (%s, %s, %s, %s, %s::vector)",
            (str(uuid.uuid4()), incident_id, org, f"Incident: {title}", vector_literal(vectors[incident_id])),
        )
    conn.commit()
    cur.close()
    conn.close()
    return ids


def embedding_owners(pg_url):
    conn = psycopg2.connect(pg_url)
    cur = conn.cursor()
    cur.execute('SELECT "incidentId", "organizationId" FROM "IncidentEmbedding"')
    rows = dict(cur.fetchall())
    conn.close()
    return rows


def test_RAG_I01_org_A_never_retrieves_org_B_even_when_B_is_the_best_match(two_orgs, fake_llm):
    result = rag.query_incidents(two_orgs["orgA"], QUESTION)

    returned = {s["incidentId"] for s in result["sources"]}
    assert returned == {two_orgs["a1"], two_orgs["a2"]}
    # The question itself mentions "payroll", so check for a marker that exists
    # ONLY in Org B's stored incident text.
    prompt = "\n".join(m["content"] for m in fake_llm.calls[0])
    assert "BRAVO-CONFIDENTIAL" not in prompt, "Org B content reached Org A's LLM prompt"


def test_RAG_I02_positive_control_org_B_does_retrieve_its_own_best_match(two_orgs):
    result = rag.query_incidents(two_orgs["orgB"], QUESTION)

    assert result["sources"][0]["incidentId"] == two_orgs["b1"]
    assert result["sources"][0]["relevance"] == pytest.approx(1.0, abs=1e-4)


def test_RAG_I03_unknown_org_retrieves_nothing_and_skips_the_llm(two_orgs, fake_llm):
    result = rag.query_incidents(str(uuid.uuid4()), QUESTION)

    assert result["sources"] == [] and fake_llm.calls == []


def test_RAG_I04_reindex_touches_only_the_requested_org(two_orgs, pg_url):
    result = rag.reindex_organization(two_orgs["orgA"])

    assert result == {"indexed": 2}
    owners = embedding_owners(pg_url)
    assert owners[two_orgs["b1"]] == two_orgs["orgB"]
    assert owners[two_orgs["a1"]] == two_orgs["orgA"]


def test_RAG_I05_reindex_is_idempotent_and_embeds_alert_evidence(two_orgs, pg_url):
    rag.reindex_organization(two_orgs["orgA"])
    rag.reindex_organization(two_orgs["orgA"])

    conn = psycopg2.connect(pg_url)
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*), MAX(content) FILTER (WHERE "incidentId" = %s) FROM "IncidentEmbedding"',
                (two_orgs["a1"],))
    total, a1_content = cur.fetchone()
    conn.close()
    assert total == 3
    assert "on server web-01" in a1_content and '"value": 97' in a1_content
