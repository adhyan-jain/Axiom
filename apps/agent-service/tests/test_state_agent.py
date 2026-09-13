import pytest
from app.state_agent import StateAgent
from app.llm.mock import MockProvider

@pytest.mark.asyncio
async def test_state_agent_calculation_and_narration():
    provider = MockProvider()
    agent = StateAgent(provider=provider)

    current_state = {
        "cashOnHand": 180000000,
        "monthlyBurn": 26000000,
        "goalCurrentValue": 24000000,
        "goalTargetValue": 100000000,
    }

    event = {
        "entityType": "Contract",
        "newState": {"status": "SIGNED", "valueAmount": 20000000, "billingCycle": "one_time"},
    }

    new_state = agent.calculate_new_state(current_state, event)
    assert new_state["goalCurrentValue"] == 44000000
    assert new_state["cashOnHand"] == 200000000
    assert new_state["runwayMonths"] == 7.69

    narrative = await agent.narrate_update(current_state, new_state, event)
    assert narrative.summary is not None
    assert narrative.bottleneck is not None
