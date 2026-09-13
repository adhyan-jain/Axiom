"""Deterministic mock LLM provider — no external calls.

Used for tests and offline demo. Given the same `prompt`/`schema` pair, always returns the
same output (hashed off the prompt text), so tests can assert exact values instead of
"looks roughly right."
"""

from __future__ import annotations

import hashlib
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.llm.base import CompletionResult, LLMProvider

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class MockProvider(LLMProvider):
    """Canned, deterministic responses. Never makes a network call."""

    name = "mock"

    async def complete(
        self,
        prompt: str,
        schema: type[SchemaT] | None = None,
        **kwargs: Any,
    ) -> CompletionResult:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]
        text = f"[mock:{digest}] deterministic response to: {prompt[:120]}"

        structured: BaseModel | None = None
        if schema is not None:
            structured = self._build_structured(schema, prompt, digest)

        return CompletionResult(
            text=text,
            structured=structured,
            provider=self.name,
            model="mock-deterministic-v1",
        )

    @staticmethod
    def _build_structured(schema: type[SchemaT], prompt: str, digest: str) -> SchemaT:
        """Construct a schema-valid instance deterministically from prompt/schema.

        Strategy: for each required field, synthesize a deterministic value based on its
        declared type and the prompt digest, then let Pydantic validate the result. This
        keeps the mock provider honest — it goes through real schema validation rather than
        special-casing specific schemas — while staying wholly offline/deterministic.
        """
        values: dict[str, Any] = {}
        for field_name, field_info in schema.model_fields.items():
            values[field_name] = MockProvider._synthesize_value(field_info.annotation, field_name, digest)

        try:
            return schema.model_validate(values)
        except ValidationError as exc:  # pragma: no cover - defensive; see module docstring
            raise ValueError(
                f"MockProvider could not synthesize a valid '{schema.__name__}' instance "
                f"for prompt digest {digest}: {exc}"
            ) from exc

    @staticmethod
    def _synthesize_value(annotation: Any, field_name: str, digest: str) -> Any:
        origin = getattr(annotation, "__origin__", None)

        if annotation is str:
            return f"mock-{field_name}-{digest}"
        if annotation is int:
            return int(digest[:4], 16) % 1000
        if annotation is float:
            return (int(digest[:4], 16) % 1000) / 10.0
        if annotation is bool:
            return int(digest[0], 16) % 2 == 0
        if origin is list:
            return []
        if origin is dict:
            return {}
        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            return {
                name: MockProvider._synthesize_value(info.annotation, name, digest)
                for name, info in annotation.model_fields.items()
            }
        # Fallback for Optional[...], Literal[...], unions, etc: None lets Pydantic apply
        # a default/raise a clear validation error rather than us guessing wrong.
        return None
