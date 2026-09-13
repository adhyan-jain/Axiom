"""Named Pydantic schemas usable from the `/llm/complete` debug endpoint's `schema_name`.

This is intentionally small for Slice 2 — later slices (Observer/Strategist/etc.) will
define their own real schemas next to the agent that uses them. This registry exists so
the debug endpoint can demonstrate/exercise the structured-output path end to end without
inventing throwaway one-off schemas inline in the route handler.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class EchoSchema(BaseModel):
    """Trivial structured-output demo schema: model restates the prompt + a short summary."""

    summary: str = Field(description="A one-sentence summary of the prompt.")
    word_count: int = Field(description="Approximate word count of the prompt.")


class SentimentSchema(BaseModel):
    """Structured classification demo schema."""

    sentiment: str = Field(description="One of: positive, neutral, negative.")
    confidence: float = Field(description="Confidence in [0, 1].")
    rationale: str = Field(description="Brief rationale for the classification.")


SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "echo": EchoSchema,
    "sentiment": SentimentSchema,
}
