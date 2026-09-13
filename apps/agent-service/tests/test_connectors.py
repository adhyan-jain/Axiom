import pytest
from app.connectors import SeededConnector, LiveConnector, ConnectorNotConfiguredError, EmailConnector

@pytest.mark.asyncio
async def test_seeded_connector_fetches_fixture():
    connector = SeededConnector("gmail")
    events = await connector.fetch_latest_events()
    assert len(events) > 0
    assert events[0]["from"] == "priya@nimbushealth.care"

@pytest.mark.asyncio
async def test_live_connector_raises_not_configured():
    connector = LiveConnector("gmail")
    with pytest.raises(ConnectorNotConfiguredError):
        await connector.fetch_latest_events()

@pytest.mark.asyncio
async def test_email_connector():
    connector = EmailConnector(mode="SEEDED")
    events = await connector.fetch_latest_events()
    assert len(events) > 0
