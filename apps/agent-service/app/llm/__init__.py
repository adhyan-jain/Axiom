"""LLM provider abstraction for apps/agent-service.

See app/llm/base.py for the `LLMProvider` interface and app/llm/config.py for provider
selection (`get_provider()`). Exposes the common surface used by the rest of the app.
"""

from app.llm.base import CompletionResult, LLMProvider, ProviderNotConfiguredError
from app.llm.config import get_provider, resolve_provider_name

__all__ = [
    "CompletionResult",
    "LLMProvider",
    "ProviderNotConfiguredError",
    "get_provider",
    "resolve_provider_name",
]
