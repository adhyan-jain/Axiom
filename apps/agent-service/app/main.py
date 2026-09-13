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


class StrategistRequest(BaseModel):
    goal_data: dict[str, Any]
    financial_state: dict[str, Any]


@app.post(
    "/strategist/analyze",
    dependencies=[Depends(require_internal_secret)],
)
async def strategist_analyze(body: StrategistRequest) -> dict[str, Any]:
    """Slice 6: Strategist agent endpoint analyzing goals vs trajectory."""
    from app.strategist_operator import StrategistAgent
    agent = StrategistAgent()
    res = await agent.analyze_trajectory(body.goal_data, body.financial_state)
    return res.model_dump()


class OperatorRequest(BaseModel):
    bottleneck: dict[str, Any]
    policy_table: dict[str, str] = Field(default_factory=dict)


@app.post(
    "/operator/propose",
    dependencies=[Depends(require_internal_secret)],
)
async def operator_propose(body: OperatorRequest) -> list[dict[str, Any]]:
    """Slice 6: Operator agent endpoint proposing gated actions."""
    from app.strategist_operator import OperatorAgent, BottleneckAnalysis
    agent = OperatorAgent()
    bottleneck_obj = BottleneckAnalysis(**body.bottleneck)
    return await agent.propose_actions(bottleneck_obj, body.policy_table)


class VerifyRequest(BaseModel):
    expected: dict[str, Any]
    actual: dict[str, Any]


@app.post(
    "/verifier/verify",
    dependencies=[Depends(require_internal_secret)],
)
async def verifier_verify(body: VerifyRequest) -> dict[str, Any]:
    """Slice 7: Verifier agent endpoint."""
    from app.verifier_memory import VerifierAgent
    agent = VerifierAgent()
    res = await agent.verify_state_change(body.expected, body.actual)
    return res.model_dump()


class MemoryConflictRequest(BaseModel):
    event: dict[str, Any]
    active_decisions: list[dict[str, Any]]


@app.post(
    "/memory/check-conflict",
    dependencies=[Depends(require_internal_secret)],
)
async def memory_check_conflict(body: MemoryConflictRequest) -> dict[str, Any]:
    """Slice 7: Memory agent conflict check endpoint."""
    from app.verifier_memory import MemoryAgent
    agent = MemoryAgent()
    res = await agent.check_event_conflict(body.event, body.active_decisions)
    return res.model_dump()


class ConnectorSyncRequest(BaseModel):
    provider: str
    mode: str = "SEEDED"


@app.post(
    "/connectors/sync",
    dependencies=[Depends(require_internal_secret)],
)
async def connector_sync(body: ConnectorSyncRequest) -> list[dict[str, Any]]:
    """Slice 8: Connector sync endpoint returning fixture or live events."""
    from app.connectors import SeededConnector, LiveConnector, ConnectorNotConfiguredError
    connector = SeededConnector(body.provider) if body.mode == "SEEDED" else LiveConnector(body.provider)
    try:
        return await connector.fetch_latest_events()
    except ConnectorNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


class ScenarioRequest(BaseModel):
    question: str
    cash_on_hand: int = 180000000
    monthly_burn: int = 26000000


@app.post(
    "/scenario/evaluate",
    dependencies=[Depends(require_internal_secret)],
)
async def evaluate_scenario(body: ScenarioRequest) -> dict[str, Any]:
    """Slice 9: Scenario Engine endpoint computing counterfactual runway options."""
    from app.scenario_engine import ScenarioEngine
    engine = ScenarioEngine()
    res = await engine.evaluate_question(body.question, body.cash_on_hand, body.monthly_burn)
    return res.model_dump()






