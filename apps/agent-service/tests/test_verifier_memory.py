import pytest
from app.verifier_memory import VerifierAgent, MemoryAgent
from app.llm.mock import MockProvider

@pytest.mark.asyncio
async def test_verifier_and_memory_agents():
    provider = MockProvider()
    verifier = VerifierAgent(provider=provider)
    memory = MemoryAgent(provider=provider)

    v_res = await verifier.verify_state_change({"runwayMonths": 6.92}, {"runwayMonths": 6.92})
    assert v_res.verified is True

    decisions = [{"title": "Stay on AWS over migrating to a cheaper VPS", "reason": "revisit if AWS crosses ₹75k/mo"}]
    event = {"entityType": "Subscription", "newState": {"amount": 7800000}}

    m_res = await memory.check_event_conflict(event, decisions)
    assert m_res.has_conflict is True
