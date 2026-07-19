from fastapi import FastAPI

app = FastAPI(title="InfraSentinel AI Service")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}