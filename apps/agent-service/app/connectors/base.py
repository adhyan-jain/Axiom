"""Connector abstractions & seeded implementations — Slice 8.

Defines abstract base classes for integration connectors (Gmail, Slack, Calendar, Drive, GitHub),
providing SeededConnector implementations reading fixture data and LiveConnector stubs raising
NotConfiguredError until OAuth credentials are provided.
"""

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

class ConnectorNotConfiguredError(Exception):
    """Raised when attempting to execute live operations without OAuth credentials."""

class BaseConnector(ABC):
    @abstractmethod
    async def fetch_latest_events(self) -> list[dict[str, Any]]:
        pass

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "seeded_data.json"

def _load_fixtures() -> dict[str, Any]:
    if FIXTURE_PATH.exists():
        with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

class SeededConnector(BaseConnector):
    def __init__(self, provider_key: str):
        self.provider_key = provider_key

    async def fetch_latest_events(self) -> list[dict[str, Any]]:
        data = _load_fixtures()
        return data.get(self.provider_key, [])

class LiveConnector(BaseConnector):
    def __init__(self, provider_key: str):
        self.provider_key = provider_key

    async def fetch_latest_events(self) -> list[dict[str, Any]]:
        raise ConnectorNotConfiguredError(
            f"Live OAuth connector for {self.provider_key!r} is not configured."
        )

class EmailConnector(SeededConnector):
    def __init__(self, mode: str = "SEEDED"):
        super().__init__("gmail") if mode == "SEEDED" else LiveConnector.__init__(self, "gmail")

class SlackConnector(SeededConnector):
    def __init__(self, mode: str = "SEEDED"):
        super().__init__("slack") if mode == "SEEDED" else LiveConnector.__init__(self, "slack")

class CalendarConnector(SeededConnector):
    def __init__(self, mode: str = "SEEDED"):
        super().__init__("calendar") if mode == "SEEDED" else LiveConnector.__init__(self, "calendar")

class DriveConnector(SeededConnector):
    def __init__(self, mode: str = "SEEDED"):
        super().__init__("drive") if mode == "SEEDED" else LiveConnector.__init__(self, "drive")

class GitHubConnector(SeededConnector):
    def __init__(self, mode: str = "SEEDED"):
        super().__init__("github") if mode == "SEEDED" else LiveConnector.__init__(self, "github")
