import hmac
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from inference import score_server
from rag import index_single_incident, query_incidents, reindex_organization

load_dotenv(dotenv_path=os.path.join(
    os.path.dirname(os.path.abspath(__file__)), ".env"))

app = FastAPI(title="InfraSentinel AI Service")

# Paths that stay reachable without the shared secret (liveness checks).
PUBLIC_PATHS = {"/health"}


@app.middleware("http")
async def require_shared_secret(request: Request, call_next):
    """Only the InfraSentinel API may call this service: every request except
    /health must carry AI_SERVICE_SHARED_SECRET in the x-internal-secret header
    (same names as on the main branch)."""
    if request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    expected = os.getenv("AI_SERVICE_SHARED_SECRET")
    if not expected:
        # Fail closed: an unconfigured service must not be open to everyone.
        return JSONResponse(status_code=503, content={
            "detail": "AI_SERVICE_SHARED_SECRET is not configured on the AI service"})

    provided = request.headers.get("x-internal-secret", "")
    if not hmac.compare_digest(provided.encode(), expected.encode()):
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


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


class RagIndexIncidentRequest(BaseModel):
    incidentId: str
    organizationId: str


@app.post("/rag/reindex")
def rag_reindex(req: RagReindexRequest):
    return reindex_organization(req.organizationId)


@app.post("/rag/query")
def rag_query(req: RagQueryRequest):
    return query_incidents(req.organizationId, req.question)


@app.post("/rag/index-incident")
def rag_index_incident(req: RagIndexIncidentRequest):
    return index_single_incident(req.incidentId, req.organizationId)
