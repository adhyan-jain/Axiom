"""Real Anthropic provider — calls the Anthropic Messages API directly (no Strands, no
AWS). This is the "runs today, no AWS needed" provider called out in SDD §3/§22.

Structured output: for `schema is not None`, we hand the model a single synthetic tool
whose `input_schema` is the Pydantic schema's JSON schema and force `tool_choice` to that
tool, then validate the tool call's `input` back through the Pydantic model. This is the
standard, documented way to get schema-conformant output from the Anthropic API — it is
real validation (Pydantic raises on a bad response), never regex/substring parsing of free
text, per SDD §22's anti-hallucination stance.
"""

from __future__ import annotations

import os
from typing import Any, TypeVar

import anthropic
from pydantic import BaseModel

from app.llm.base import CompletionResult, LLMProvider, ProviderNotConfiguredError

SchemaT = TypeVar("SchemaT", bound=BaseModel)

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
_STRUCTURED_TOOL_NAME = "emit_structured_response"


class AnthropicProvider(LLMProvider):
    """Real LLM calls against the Anthropic API. Reads `ANTHROPIC_API_KEY` from env."""

    name = "anthropic"

    def __init__(self, api_key: str | None = None, model: str = DEFAULT_MODEL) -> None:
        self._api_key = api_key if api_key is not None else os.environ.get("ANTHROPIC_API_KEY")
        self._model = model
        # Deliberately NOT constructing the anthropic client here even if the key is
        # missing-vs-present — client construction is cheap and doesn't itself make a
        # network call, but we still gate the actual completion call below on the key
        # being present so the error is raised at use time with a clear message, matching
        # the same contract bedrock_strands.py follows.
        self._client: anthropic.AsyncAnthropic | None = (
            anthropic.AsyncAnthropic(api_key=self._api_key) if self._api_key else None
        )

    async def complete(
        self,
        prompt: str,
        schema: type[SchemaT] | None = None,
        **kwargs: Any,
    ) -> CompletionResult:
        if not self._api_key or self._client is None:
            raise ProviderNotConfiguredError(
                self.name,
                "ANTHROPIC_API_KEY is not set. Set it in the environment/.env to use the "
                "anthropic provider.",
            )

        system_prompt = kwargs.pop("system_prompt", None)
        max_tokens = kwargs.pop("max_tokens", 1024)
        temperature = kwargs.pop("temperature", 1.0)

        if schema is None:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt or anthropic.NOT_GIVEN,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(block.text for block in response.content if block.type == "text")
            return CompletionResult(text=text, structured=None, provider=self.name, model=self._model)

        # Structured path: force a tool call shaped like the schema, then validate it.
        json_schema = schema.model_json_schema()
        tool = {
            "name": _STRUCTURED_TOOL_NAME,
            "description": f"Emit a response conforming to the {schema.__name__} schema.",
            "input_schema": json_schema,
        }
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or anthropic.NOT_GIVEN,
            messages=[{"role": "user", "content": prompt}],
            tools=[tool],
            tool_choice={"type": "tool", "name": _STRUCTURED_TOOL_NAME},
        )

        tool_use_block = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_use_block is None:
            raise ValueError(
                f"anthropic provider: model did not return the expected '{_STRUCTURED_TOOL_NAME}' "
                "tool call for structured output."
            )
        structured = schema.model_validate(tool_use_block.input)
        text_block = next((b for b in response.content if b.type == "text"), None)
        text = text_block.text if text_block is not None else structured.model_dump_json()

        return CompletionResult(text=text, structured=structured, provider=self.name, model=self._model)
