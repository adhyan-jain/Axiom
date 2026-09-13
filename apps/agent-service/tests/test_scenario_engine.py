import pytest
from app.scenario_engine import ScenarioEngine
from app.llm.mock import MockProvider

@pytest.mark.asyncio
async def test_scenario_engine():
    provider = MockProvider()
    engine = ScenarioEngine(provider=provider)

    res = await engine.evaluate_question("Should I hire a developer next month?")
    assert len(res.options) == 2
    assert "Option A" in res.options[0].label
    assert "Option B" in res.options[1].label
    assert res.recommendation is not None
    assert res.trigger_condition is not None
