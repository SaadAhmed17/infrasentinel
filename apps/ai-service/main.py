import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from inference import score_server
from rag import index_single_incident, query_incidents, reindex_organization

SHARED_SECRET = os.getenv("AI_SERVICE_SHARED_SECRET")


def verify_internal_secret(x_internal_secret: str = Header(None)):
    if not SHARED_SECRET or x_internal_secret != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


app = FastAPI(title="InfraSentinel AI Service")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}


@app.get("/anomaly-score/{server_id}", dependencies=[Depends(verify_internal_secret)])
def anomaly_score(server_id: str):
    return score_server(server_id)


class RagQueryRequest(BaseModel):
    organizationId: str
    question: str


class RagReindexRequest(BaseModel):
    organizationId: str


class RagIndexIncidentRequest(BaseModel):
    incidentId: str
    organizationId: str


@app.post("/rag/reindex", dependencies=[Depends(verify_internal_secret)])
def rag_reindex(req: RagReindexRequest):
    return reindex_organization(req.organizationId)


@app.post("/rag/query", dependencies=[Depends(verify_internal_secret)])
def rag_query(req: RagQueryRequest):
    return query_incidents(req.organizationId, req.question)


@app.post("/rag/index-incident", dependencies=[Depends(verify_internal_secret)])
def rag_index_incident(req: RagIndexIncidentRequest):
    return index_single_incident(req.incidentId, req.organizationId)
