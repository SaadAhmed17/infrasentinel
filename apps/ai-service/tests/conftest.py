import hashlib
import os
import re
import shutil
import subprocess
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest

SERVICE_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = SERVICE_DIR.parents[1]
sys.path.insert(0, str(SERVICE_DIR))

# Tests must never reach a developer's real database or LLM. rag.py and
# data_pipeline.py load apps/ai-service/.env, but load_dotenv does not override
# variables that are already set, so these placeholders win.
os.environ["DATABASE_URL"] = "postgresql://tests-must-not-use-this@127.0.0.1:9/none"
os.environ["GROQ_API_KEY"] = ""

from evaluation.synthetic_telemetry import (
    normal_telemetry as _normal_telemetry,
)


class FakeEmbedder:
    """Deterministic stand-in for the all-MiniLM-L6-v2 sentence embedder.

    Unit tests must not download a 90 MB model or depend on its exact output:
    what they verify is the retrieval, filtering and prompting logic around it.
    Same text -> same 384-d unit vector, different text -> near-orthogonal.
    """

    def __init__(self, *args, **kwargs):
        pass

    def encode(self, text):
        seed = int.from_bytes(hashlib.sha256(text.encode()).digest()[:8], "big")
        vec = np.random.default_rng(seed).standard_normal(384)
        return vec / np.linalg.norm(vec)


# Must be installed before rag.py is imported (it loads the model at import time).
_fake_st = types.ModuleType("sentence_transformers")
_fake_st.SentenceTransformer = FakeEmbedder
sys.modules["sentence_transformers"] = _fake_st


class FakeLLM:
    """Records every prompt; answers with a canned reply or raises `error`."""

    def __init__(self, answer="stub answer", error=None):
        self.answer, self.error, self.calls = answer, error, []
        self.chat = SimpleNamespace(completions=self)

    def create(self, model, messages, temperature):
        self.calls.append(messages)
        if self.error:
            raise self.error
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=self.answer))])


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    """Any real LLM call fails loudly; tests that need answers use fake_llm."""
    import rag

    def refuse():
        raise RuntimeError("real LLM calls are disabled in tests; use the fake_llm fixture")

    monkeypatch.setattr(rag, "get_groq_client", refuse)


@pytest.fixture
def fake_llm(monkeypatch):
    import rag

    llm = FakeLLM()
    monkeypatch.setattr(rag, "get_groq_client", lambda: llm)
    return llm


# Shared with the evaluation harness; re-exported for the tests.
normal_telemetry = _normal_telemetry


# --- real PostgreSQL + pgvector for RAG isolation tests -----------------------

def _apply_migrations(url):
    import psycopg2

    conn = psycopg2.connect(url)
    conn.autocommit = True
    with conn.cursor() as cur:
        for migration in sorted((REPO_DIR / "apps/api/prisma/migrations").glob("*/migration.sql")):
            cur.execute(migration.read_text(encoding="utf-8"))
    conn.close()


@pytest.fixture(scope="session")
def pg_url():
    """A migrated, disposable Postgres+pgvector database.

    CI provides one via RAG_TEST_DATABASE_URL (service container). Locally we start
    PGlite through Node. The schema is the project's real Prisma migration SQL.
    """
    url = os.getenv("RAG_TEST_DATABASE_URL")
    process = None
    if not url:
        node = shutil.which("node")
        script = REPO_DIR / "apps/api/test/support/pglite-server.mjs"
        if not node or not (REPO_DIR / "apps/api/node_modules/@electric-sql/pglite").exists():
            pytest.skip("no test database: set RAG_TEST_DATABASE_URL or install apps/api dependencies")
        # PORT=0: a free port, even when the service's .env (loaded into the
        # environment on import) sets PORT for the service itself.
        process = subprocess.Popen(
            [node, str(script)], stdout=subprocess.PIPE, text=True, env={**os.environ, "PORT": "0"}
        )
        ready = process.stdout.readline()
        port = re.search(r"READY (\d+)", ready).group(1)
        url = f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres?sslmode=disable"

    if re.search(r"neon\.tech|amazonaws|supabase", url):
        pytest.exit("Refusing to run destructive tests against a cloud database")
    _apply_migrations(url)
    yield url

    if process:
        process.terminate()
        process.wait(timeout=10)
