"""Axiom agent-service — FastAPI entrypoint.

Slice 0: health endpoint, protected by the shared-secret internal-auth dependency that
every later slice's routes will also use. See app/auth.py.

Slice 2: `/llm/complete` debug/dev endpoint exercising the LLM provider abstraction
(app/llm/) end to end — same auth dependency, used for manual smoke-testing and by
later slices' tests.
"""

from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from app.auth import require_internal_secret
from app.llm import ProviderNotConfiguredError, get_provider
from app.llm.schemas import SCHEMA_REGISTRY

app = FastAPI(title="Axiom agent-service")


@app.get("/health", dependencies=[Depends(require_internal_secret)])
async def health() -> dict[str, str]:
    return {"status": "ok"}


class LLMCompleteRequest(BaseModel):
    prompt: str
    schema_name: str | None = None
    system_prompt: str | None = None


class LLMCompleteResponse(BaseModel):
    text: str
    structured: dict[str, Any] | None = None
    provider: str
    model: str


@app.post(
    "/llm/complete",
    dependencies=[Depends(require_internal_secret)],
    response_model=LLMCompleteResponse,
)
async def llm_complete(body: LLMCompleteRequest) -> LLMCompleteResponse:
    """Debug/dev endpoint: run one prompt through the auto-selected/configured LLM
    provider and report which provider handled it. Useful for manual smoke-testing the
    provider abstraction (mock/anthropic/bedrock_strands) and for later slices' tests.
    """
    schema = None
    if body.schema_name is not None:
        schema = SCHEMA_REGISTRY.get(body.schema_name)
        if schema is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown schema_name {body.schema_name!r}. Known: {sorted(SCHEMA_REGISTRY)}",
            )

    provider = get_provider()
    try:
        result = await provider.complete(
            body.prompt,
            schema=schema,
            system_prompt=body.system_prompt,
        )
    except ProviderNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return LLMCompleteResponse(
        text=result.text,
        structured=result.structured.model_dump() if result.structured is not None else None,
        provider=result.provider,
        model=result.model,
    )


class ProcessEventRequest(BaseModel):
    event: dict[str, Any]


@app.post(
    "/observer/process",
    dependencies=[Depends(require_internal_secret)],
)
async def process_event(body: ProcessEventRequest) -> dict[str, Any]:
    """Slice 3: Observer agent endpoint that classifies an event's significance and recommended actions."""
    from app.observer import ObserverAgent
    agent = ObserverAgent()
    classification = await agent.classify_event(body.event)
    return classification.model_dump()


class StateProcessRequest(BaseModel):
    current_state: dict[str, Any]
    event: dict[str, Any]


@app.post(
    "/state/process",
    dependencies=[Depends(require_internal_secret)],
)
async def process_state_update(body: StateProcessRequest) -> dict[str, Any]:
    """Slice 4: State Agent endpoint computing deterministic metric deltas and LLM narration."""
    from app.state_agent import StateAgent
    agent = StateAgent()
    new_state = agent.calculate_new_state(body.current_state, body.event)
    narrative = await agent.narrate_update(body.current_state, new_state, body.event)
    return {
        "new_state": new_state,
        "narrative": narrative.model_dump(),
    }


