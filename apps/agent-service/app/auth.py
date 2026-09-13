"""Internal-call authentication for apps/agent-service.

Every request from apps/web must carry the shared secret in the
`X-Axiom-Internal-Secret` header (see docs/SDD.md, "apps/web <-> agent-service" convention
introduced in Slice 0 and used by every later slice's cross-service call). This module is
the single reusable FastAPI dependency that validates it — add it to any route that should
only be reachable from apps/web.
"""

from fastapi import Header, HTTPException, status

from app.settings import settings

INTERNAL_SECRET_HEADER = "X-Axiom-Internal-Secret"


async def require_internal_secret(
    x_axiom_internal_secret: str | None = Header(default=None, alias=INTERNAL_SECRET_HEADER),
) -> None:
    """FastAPI dependency: raise 401 unless the shared-secret header matches."""
    if not x_axiom_internal_secret or x_axiom_internal_secret != settings.agent_service_shared_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid internal secret header.",
        )
