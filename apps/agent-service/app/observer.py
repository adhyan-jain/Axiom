"""Observer agent implementation — Slice 3.

The Observer agent polls unprocessed events from Next.js (web app), evaluates their
significance and impact using the active LLM provider (app/llm), and writes updated status
and analysis back to Next.js's API.
"""

from typing import Any
from pydantic import BaseModel, Field
from app.llm import get_provider, LLMProvider

class EventClassification(BaseModel):
  significance: str = Field(..., description="HIGH, MEDIUM, LOW, or ANOMALY")
  summary: str = Field(..., description="Terse summary of the event significance")
  recommended_actions: list[str] = Field(default_factory=list, description="Recommended downstream actions")
  flagged_anomalies: list[str] = Field(default_factory=list, description="Any detected anomalies or policy conflicts")

class ObserverAgent:
  def __init__(self, provider: LLMProvider | None = None):
    self.provider = provider or get_provider()

  async def classify_event(self, event_data: dict[str, Any]) -> EventClassification:
    prompt = f"""Analyze the following company event and classify its significance, summary, recommended actions, and any anomalies:

Event Details:
- Source: {event_data.get('source')}
- Entity Type: {event_data.get('entityType')}
- Previous State: {event_data.get('previousState')}
- New State: {event_data.get('newState')}
- Evidence: {event_data.get('evidence')}
"""
    system_prompt = (
        "You are Axiom's Observer Agent. Your job is to classify company events "
        "impartially and identify key changes or anomalies."
    )

    result = await self.provider.complete(
        prompt=prompt,
        schema=EventClassification,
        system_prompt=system_prompt,
    )

    if result.structured and isinstance(result.structured, EventClassification):
      return result.structured

    # Fallback default if structured parsing returned raw or mock schema
    return EventClassification(
        significance="MEDIUM",
        summary="Event processed by Observer",
        recommended_actions=["Review event details"],
        flagged_anomalies=[],
    )
