"""Axiom agent-service — FastAPI entrypoint.

Slice 0: just a health endpoint, protected by the shared-secret internal-auth dependency
that every later slice's routes will also use. See app/auth.py.
"""

from fastapi import Depends, FastAPI

from app.auth import require_internal_secret

app = FastAPI(title="Axiom agent-service")


@app.get("/health", dependencies=[Depends(require_internal_secret)])
async def health() -> dict[str, str]:
    return {"status": "ok"}
