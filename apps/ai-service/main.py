from fastapi import FastAPI

from inference import score_server

from pydantic import BaseModel
from rag import reindex_organization, query_incidents

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


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}


@app.get("/anomaly-score/{server_id}")
def anomaly_score(server_id: str):
    return score_server(server_id)


@app.post("/rag/reindex")
def rag_reindex(req: RagReindexRequest):
    return reindex_organization(req.organizationId)


@app.post("/rag/query")
def rag_query(req: RagQueryRequest):
    return query_incidents(req.organizationId, req.question)
