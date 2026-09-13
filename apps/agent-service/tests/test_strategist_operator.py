import pytest
from app.strategist_operator import StrategistAgent, OperatorAgent, BottleneckAnalysis
from app.llm.mock import MockProvider

@pytest.mark.asyncio
async def test_strategist_and_operator_agents():
    provider = MockProvider()
    strategist = StrategistAgent(provider=provider)
    operator = OperatorAgent(provider=provider)

    goal_data = {"title": "Reach ₹10L ARR", "targetValue": 100000000, "currentValue": 24000000}
    fin_state = {"cashOnHand": 180000000, "monthlyBurn": 26000000}

    bottleneck = await strategist.analyze_trajectory(goal_data, fin_state)
    assert bottleneck.primary_bottleneck is not None

    proposals = await operator.propose_actions(bottleneck, {"create_task": "RECOMMEND"})
    assert len(proposals) > 0
    assert "task" in proposals[0]
    assert "gate_result" in proposals[0]
