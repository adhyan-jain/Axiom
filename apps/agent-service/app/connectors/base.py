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

def _make_connector(provider_key: str, mode: str) -> BaseConnector:
    """Return a real LiveConnector in LIVE mode.

    The previous per-provider subclasses inherited from SeededConnector and, in "LIVE"
    mode, called `LiveConnector.__init__(self, ...)` on that SeededConnector-typed
    `self`. That only overwrote `provider_key`; method resolution still picked
    `SeededConnector.fetch_latest_events`, so "LIVE" mode silently kept serving seeded
    fixture data instead of raising ConnectorNotConfiguredError.
    """
    return LiveConnector(provider_key) if mode == "LIVE" else SeededConnector(provider_key)

def EmailConnector(mode: str = "SEEDED") -> BaseConnector:
    return _make_connector("gmail", mode)

def SlackConnector(mode: str = "SEEDED") -> BaseConnector:
    return _make_connector("slack", mode)

def CalendarConnector(mode: str = "SEEDED") -> BaseConnector:
    return _make_connector("calendar", mode)

def DriveConnector(mode: str = "SEEDED") -> BaseConnector:
    return _make_connector("drive", mode)

def GitHubConnector(mode: str = "SEEDED") -> BaseConnector:
    return _make_connector("github", mode)
