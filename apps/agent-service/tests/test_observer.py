import pytest
from app.observer import ObserverAgent
from app.llm.mock import MockProvider

@pytest.mark.asyncio
async def test_observer_agent_classification():
    provider = MockProvider()
    agent = ObserverAgent(provider=provider)
    
    sample_event = {
        "source": "manual",
        "entityType": "Contract",
        "previousState": None,
        "newState": {"status": "SIGNED", "valueAmount": 20000000},
        "evidence": ["Signed PDF uploaded"],
    }
    
    res = await agent.classify_event(sample_event)
    assert res.significance is not None
    assert isinstance(res.summary, str)
