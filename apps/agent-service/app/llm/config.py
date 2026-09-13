"""Provider selection logic.

`LLM_PROVIDER` env var (`mock` | `anthropic` | `bedrock_strands`) picks explicitly; if
unset, auto-detect: bedrock_strands (if AWS creds present) -> anthropic (if
ANTHROPIC_API_KEY present) -> mock. See docs/DECISIONS.md and docs/SDD.md §3.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import LLMProvider
from app.llm.bedrock_strands import BedrockStrandsProvider, _aws_credentials_available
from app.llm.mock import MockProvider

ProviderName = Literal["mock", "anthropic", "bedrock_strands"]
_VALID_PROVIDER_NAMES: tuple[ProviderName, ...] = ("mock", "anthropic", "bedrock_strands")


def resolve_provider_name() -> ProviderName:
    """Determine which provider should be used, without instantiating it.

    Explicit `LLM_PROVIDER` env var wins if set and valid. Otherwise auto-detect:
    bedrock_strands (AWS creds present) -> anthropic (ANTHROPIC_API_KEY present) -> mock.
    """
    explicit = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if explicit:
        if explicit not in _VALID_PROVIDER_NAMES:
            raise ValueError(
                f"Invalid LLM_PROVIDER={explicit!r}; must be one of {_VALID_PROVIDER_NAMES}."
            )
        return explicit  # type: ignore[return-value]

    if _aws_credentials_available():
        return "bedrock_strands"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    return "mock"


def build_provider(name: ProviderName) -> LLMProvider:
    """Instantiate the given provider by name. Never raises for missing credentials —
    that's deferred to the provider's `complete()` call (see ProviderNotConfiguredError).
    """
    if name == "mock":
        return MockProvider()
    if name == "anthropic":
        return AnthropicProvider()
    if name == "bedrock_strands":
        return BedrockStrandsProvider()
    raise ValueError(f"Unknown provider name: {name!r}")  # pragma: no cover - guarded by Literal


def get_provider() -> LLMProvider:
    """Factory: resolve + instantiate the provider selected by env (cached per process).

    Not cached across env var changes within a process — call `get_provider.cache_clear()`
    in tests after monkeypatching `LLM_PROVIDER`/credential env vars.
    """
    return _get_provider_cached(resolve_provider_name())


@lru_cache(maxsize=None)
def _get_provider_cached(name: ProviderName) -> LLMProvider:
    return build_provider(name)


get_provider.cache_clear = _get_provider_cached.cache_clear  # type: ignore[attr-defined]
