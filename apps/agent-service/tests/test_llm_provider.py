"""Tests for app/llm/ — provider selection, mock determinism, bedrock_strands inertness
without AWS creds, and (if ANTHROPIC_API_KEY is genuinely present) a real integration test
against the anthropic provider.
"""

from __future__ import annotations

import os

import pytest

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import ProviderNotConfiguredError
from app.llm.bedrock_strands import BedrockStrandsProvider
from app.llm.config import build_provider, resolve_provider_name
from app.llm.mock import MockProvider
from app.llm.schemas import EchoSchema

AWS_ENV_VARS = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_PROFILE",
    "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
]


@pytest.fixture
def clean_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Strip every env var that influences provider auto-detection."""
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    for var in AWS_ENV_VARS:
        monkeypatch.delenv(var, raising=False)
    # Prevent boto3's default credential chain (shared config files, SSO cache, etc.) from
    # leaking into the "no creds" test cases when run on a machine that has a real AWS CLI
    # profile configured outside of env vars.
    monkeypatch.setenv("AWS_SHARED_CREDENTIALS_FILE", "/dev/null/does-not-exist")
    monkeypatch.setenv("AWS_CONFIG_FILE", "/dev/null/does-not-exist")


# --- Provider selection / auto-detection -----------------------------------------------


class TestProviderSelection:
    def test_defaults_to_mock_with_no_env(self, clean_provider_env: None) -> None:
        assert resolve_provider_name() == "mock"

    def test_anthropic_key_selects_anthropic(
        self, clean_provider_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-fake-key")
        assert resolve_provider_name() == "anthropic"

    def test_aws_creds_select_bedrock_strands(
        self, clean_provider_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "fake-access-key")
        monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "fake-secret-key")
        assert resolve_provider_name() == "bedrock_strands"

    def test_bedrock_takes_priority_over_anthropic(
        self, clean_provider_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-fake-key")
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "fake-access-key")
        monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "fake-secret-key")
        assert resolve_provider_name() == "bedrock_strands"

    def test_explicit_llm_provider_env_wins(
        self, clean_provider_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "fake-access-key")
        monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "fake-secret-key")
        monkeypatch.setenv("LLM_PROVIDER", "mock")
        assert resolve_provider_name() == "mock"

    def test_invalid_explicit_llm_provider_raises(
        self, clean_provider_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("LLM_PROVIDER", "not-a-real-provider")
        with pytest.raises(ValueError):
            resolve_provider_name()

    def test_build_provider_returns_correct_types(self) -> None:
        assert isinstance(build_provider("mock"), MockProvider)
        assert isinstance(build_provider("anthropic"), AnthropicProvider)
        assert isinstance(build_provider("bedrock_strands"), BedrockStrandsProvider)


# --- Mock provider determinism ----------------------------------------------------------


class TestMockProvider:
    async def test_same_prompt_same_text(self) -> None:
        provider = MockProvider()
        r1 = await provider.complete("hello world")
        r2 = await provider.complete("hello world")
        assert r1.text == r2.text
        assert r1.provider == "mock"

    async def test_different_prompt_different_text(self) -> None:
        provider = MockProvider()
        r1 = await provider.complete("hello world")
        r2 = await provider.complete("goodbye world")
        assert r1.text != r2.text

    async def test_structured_output_validates_and_is_deterministic(self) -> None:
        provider = MockProvider()
        r1 = await provider.complete("classify this", schema=EchoSchema)
        r2 = await provider.complete("classify this", schema=EchoSchema)
        assert isinstance(r1.structured, EchoSchema)
        assert r1.structured == r2.structured

    async def test_makes_no_network_calls(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Sanity check the 'no external calls' claim: break socket-level networking and
        confirm the mock provider still works."""
        import socket

        def _blocked(*args: object, **kwargs: object) -> None:
            raise AssertionError("MockProvider must not touch the network")

        monkeypatch.setattr(socket, "socket", _blocked)
        provider = MockProvider()
        result = await provider.complete("no network allowed")
        assert result.provider == "mock"


# --- bedrock_strands: inert without AWS creds --------------------------------------------


class TestBedrockStrandsProviderInert:
    def test_import_and_construct_without_creds_does_not_raise(
        self, clean_provider_env: None
    ) -> None:
        # Must not raise merely by importing the module or instantiating the class.
        provider = BedrockStrandsProvider()
        assert provider.name == "bedrock_strands"

    async def test_complete_raises_provider_not_configured_without_creds(
        self, clean_provider_env: None
    ) -> None:
        provider = BedrockStrandsProvider()
        with pytest.raises(ProviderNotConfiguredError) as exc_info:
            await provider.complete("hello")
        assert "bedrock_strands" in str(exc_info.value)

    def test_register_before_tool_call_does_not_require_creds(
        self, clean_provider_env: None
    ) -> None:
        provider = BedrockStrandsProvider()
        provider.register_before_tool_call(lambda event: None)
        assert len(provider._before_tool_call_hooks) == 1


# --- anthropic provider ------------------------------------------------------------------


class TestAnthropicProviderConfiguration:
    async def test_raises_provider_not_configured_without_key(
        self, clean_provider_env: None
    ) -> None:
        provider = AnthropicProvider(api_key=None)
        with pytest.raises(ProviderNotConfiguredError):
            await provider.complete("hello")


@pytest.mark.integration
class TestAnthropicProviderLive:
    """Real API call. Skipped automatically unless ANTHROPIC_API_KEY is genuinely set."""

    async def test_live_completion(self) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            pytest.skip("ANTHROPIC_API_KEY not set in this environment")

        provider = AnthropicProvider(api_key=api_key)
        result = await provider.complete(
            "Reply with exactly the single word: PONG",
            max_tokens=16,
        )
        assert result.provider == "anthropic"
        assert "PONG" in result.text.upper()

    async def test_live_structured_output(self) -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            pytest.skip("ANTHROPIC_API_KEY not set in this environment")

        provider = AnthropicProvider(api_key=api_key)
        result = await provider.complete(
            "The quick brown fox jumps over the lazy dog.",
            schema=EchoSchema,
        )
        assert isinstance(result.structured, EchoSchema)
        assert result.structured.word_count > 0
