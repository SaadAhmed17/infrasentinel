from fastapi import FastAPI
from pydantic import BaseModel

from inference import score_server
from rag import query_incidents, reindex_organization

app = FastAPI(title="InfraSentinel AI Service")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}


@app.get("/anomaly-score/{server_id}")
def anomaly_score(server_id: str):
    return score_server(server_id)


class RagQueryRequest(BaseModel):
    organizationId: str
    question: str


class RagReindexRequest(BaseModel):
    organizationId: str


@app.post("/rag/reindex")
def rag_reindex(req: RagReindexRequest):
    return reindex_organization(req.organizationId)


@app.post("/rag/query")
def rag_query(req: RagQueryRequest):
    return query_incidents(req.organizationId, req.question)
