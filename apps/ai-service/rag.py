import json
import os

import psycopg2
from dotenv import load_dotenv
from groq import Groq
from sentence_transformers import SentenceTransformer

load_dotenv(dotenv_path=os.path.join(
    os.path.dirname(os.path.abspath(__file__)), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

# Loaded once at import time — reused across every request rather than reloading per-call
_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
_groq_client = None


def get_groq_client():
    """Create the Groq client on first real use, not at import time — so importing
    this module never requires a live API key (e.g. for CI syntax checks)."""
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def embed_text(text: str) -> list[float]:
    """Turn a piece of text into a 384-dimensional vector."""
    return _embedding_model.encode(text).tolist()


def build_incident_summary(incident: dict, alerts: list[dict]) -> str:
    """
    Turn a raw Incident + its Alerts into a plain-text summary — this is
    literally what gets embedded and later shown to the LLM as context.
    """
    lines = [
        f"Incident: {incident['title']}",
        f"Severity: {incident['severity']}",
        f"Status: {incident['status']}",
        f"Created: {incident['createdAt']}",
    ]
    for alert in alerts:
        server_part = f" on server {alert['server_name']}" if alert.get(
            'server_name') else ""
        lines.append(
            f"- Alert from rule '{alert['rule_name']}'{server_part}: {json.dumps(alert['details'])}")
    return "\n".join(lines)


def reindex_organization(organization_id: str) -> dict:
    """
    Pull every incident for this org, build a summary, embed it, and store/update
    it in IncidentEmbedding. Safe to re-run — it upserts, never duplicates.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT i.id, i.title, i.severity, i.status, i."createdAt"
        FROM "Incident" i
        WHERE i."organizationId" = %s
        """,
        (organization_id,),
    )
    incidents = cur.fetchall()

    indexed_count = 0
    for incident_row in incidents:
        incident_id, title, severity, status, created_at = incident_row

        cur.execute(
            """
            SELECT r.name, s.name, a.details
            FROM "Alert" a
            JOIN "Rule" r ON a."ruleId" = r.id
            LEFT JOIN "Server" s ON a."serverId" = s.id
            WHERE a."incidentId" = %s
            """,
            (incident_id,),
        )
        alert_rows = cur.fetchall()
        alerts = [
            {"rule_name": r[0], "server_name": r[1], "details": r[2]}
            for r in alert_rows
        ]

        summary = build_incident_summary(
            {"title": title, "severity": severity,
                "status": status, "createdAt": str(created_at)},
            alerts,
        )
        vector = embed_text(summary)

        cur.execute(
            """
            INSERT INTO "IncidentEmbedding" (id, "incidentId", "organizationId", content, embedding, "createdAt")
            VALUES (gen_random_uuid(), %s, %s, %s, %s::vector, NOW())
            ON CONFLICT ("incidentId")
            DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
            """,
            (incident_id, organization_id, summary, vector),
        )
        indexed_count += 1

    conn.commit()
    cur.close()
    conn.close()

    return {"indexed": indexed_count}


def query_incidents(organization_id: str, question: str, top_k: int = 5) -> dict:
    """
    Embed the question, find the top_k most similar incidents FOR THIS ORG ONLY,
    then ask Groq to answer using only that retrieved context.
    """
    question_vector = embed_text(question)

    conn = get_connection()
    cur = conn.cursor()

    # <=> is pgvector's cosine-distance operator — lower distance means more similar.
    # The organizationId filter runs in the SAME query as the similarity search,
    # so a different org's incidents are never even considered, not just filtered out after.
    cur.execute(
        """
        SELECT ie."incidentId", ie.content, i.title, i.severity, i.status,
               (ie.embedding <=> %s::vector) AS distance
        FROM "IncidentEmbedding" ie
        JOIN "Incident" i ON ie."incidentId" = i.id
        WHERE ie."organizationId" = %s
        ORDER BY distance ASC
        LIMIT %s
        """,
        (question_vector, organization_id, top_k),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        return {
            "answer": "No incidents have been indexed yet for this organization, so I don't have any data to answer from.",
            "sources": [],
        }

    context_blocks = [row[1] for row in rows]
    context_text = "\n\n---\n\n".join(context_blocks)

    system_prompt = (
        "You are an incident analysis assistant for InfraSentinel, a server monitoring platform. "
        "Answer the user's question using ONLY the incident data provided below. "
        "If the provided incidents don't contain enough information to answer, say so honestly "
        "rather than guessing or using outside knowledge."
    )
    user_prompt = f"Incident data:\n\n{context_text}\n\nQuestion: {question}"

    completion = get_groq_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    answer = completion.choices[0].message.content

    sources = [
        {"incidentId": row[0], "title": row[2], "severity": row[3],
            "status": row[4], "relevance": round(1 - row[5], 4)}
        for row in rows
    ]

    return {"answer": answer, "sources": sources}


def index_single_incident(incident_id: str, organization_id: str) -> dict:
    """
    Embed (or re-embed) exactly one incident. Used for auto-indexing right
    after an incident is created, instead of a full org reindex every time.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT i.id, i.title, i.severity, i.status, i."createdAt"
        FROM "Incident" i
        WHERE i.id = %s AND i."organizationId" = %s
        """,
        (incident_id, organization_id),
    )
    incident_row = cur.fetchone()
    if not incident_row:
        cur.close()
        conn.close()
        return {"indexed": False, "reason": "incident not found for this organization"}

    _, title, severity, status, created_at = incident_row

    cur.execute(
        """
        SELECT r.name, s.name, a.details
        FROM "Alert" a
        JOIN "Rule" r ON a."ruleId" = r.id
        LEFT JOIN "Server" s ON a."serverId" = s.id
        WHERE a."incidentId" = %s
        """,
        (incident_id,),
    )
    alert_rows = cur.fetchall()
    alerts = [{"rule_name": r[0], "server_name": r[1], "details": r[2]}
              for r in alert_rows]

    summary = build_incident_summary(
        {"title": title, "severity": severity,
            "status": status, "createdAt": str(created_at)},
        alerts,
    )
    vector = embed_text(summary)

    cur.execute(
        """
        INSERT INTO "IncidentEmbedding" (id, "incidentId", "organizationId", content, embedding, "createdAt")
        VALUES (gen_random_uuid(), %s, %s, %s, %s::vector, NOW())
        ON CONFLICT ("incidentId")
        DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
        """,
        (incident_id, organization_id, summary, vector),
    )
    conn.commit()
    cur.close()
    conn.close()

    return {"indexed": True, "incidentId": incident_id}
