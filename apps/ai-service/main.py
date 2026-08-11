from fastapi import FastAPI

from inference import score_server

app = FastAPI(title="InfraSentinel AI Service")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}


@app.get("/anomaly-score/{server_id}")
def anomaly_score(server_id: str):
    return score_server(server_id)
