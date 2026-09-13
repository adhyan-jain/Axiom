"""LLM provider abstraction — `LLMProvider` interface.

Design constraints (see docs/DECISIONS.md "LLM provider abstraction instead of hard
Bedrock dependency" and "Strands owns the agent/tool loop; our app owns authority"):

- Every provider returns a *structured/validated* result (Pydantic), never free-text the
  caller has to regex/parse itself. Per SDD's anti-hallucination stance, the LLM is never
  trusted to hand back ad-hoc strings that get parsed as facts — schema validation is the
  boundary. `complete()` always returns a `CompletionResult`; when a `schema` is passed,
  `CompletionResult.structured` is a *validated instance of that schema*, not a string that
  merely looks like JSON.
- Providers that genuinely drive an agentic tool-call loop (bedrock_strands) also expose a
  hook/intervention-registration surface (`register_before_tool_call`) so later slices
  (Slice 5's permission gate) can plug an authorization check directly into the tool-call
  loop itself — never by prompting the model to "please ask before doing X". Providers that
  don't run a tool loop (mock, anthropic used as a bare completion client) implement this as
  a no-op-with-a-clear-error, since there is no tool loop to intervene on.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable, Generic, TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)

# The shape later slices' `before_tool_call`-style intervention callbacks take. Kept as a
# loose `Callable[..., Any]` here (rather than importing strands.interventions types) so
# that `mock`/`anthropic` providers — which have no tool loop — don't need the `strands`
# package as a hard import dependency. `bedrock_strands.py` narrows this to the real
# `strands.interventions.InterventionHandler` contract.
BeforeToolCallHook = Callable[..., Any]


class ProviderNotConfiguredError(RuntimeError):
    """Raised when a provider is selected/instantiated but its required credentials or
    configuration are absent.

    Must be raised at first *use* (or at construction with a clear message) — never let a
    provider crash uglily mid-call, and never let importing/instantiating it without
    credentials raise anything other than this typed error. This lets the rest of the app
    safely reference `bedrock_strands` even when AWS credentials aren't present yet.
    """

    def __init__(self, provider: str, message: str) -> None:
        self.provider = provider
        super().__init__(f"[{provider}] not configured: {message}")


class CompletionResult(BaseModel):
    """Uniform return shape for `LLMProvider.complete()`.

    `text` is always populated (the raw/narration completion). `structured` is populated
    only when a `schema` was passed to `complete()`, and is guaranteed to be a validated
    instance of that schema — never a hand-parsed string.
    """

    model_config = {"arbitrary_types_allowed": True}

    text: str
    structured: BaseModel | None = None
    provider: str
    model: str


class LLMProvider(ABC, Generic[SchemaT]):
    """Common interface every LLM provider implements.

    `name` identifies the provider for logging/audit/debug-endpoint responses (SDD's
    audit log records which provider/model produced a given output).
    """

    name: str

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        schema: type[SchemaT] | None = None,
        **kwargs: Any,
    ) -> CompletionResult:
        """Run one completion.

        Args:
            prompt: the user/task prompt.
            schema: optional Pydantic model the response must validate against. When
                given, implementations MUST return a validated instance in
                `CompletionResult.structured` (never a bare string claiming to be JSON).
            **kwargs: provider-specific passthrough (e.g. system_prompt, temperature).

        Returns:
            CompletionResult with `text` always set and `structured` set iff `schema` was
            given and validation succeeded.

        Raises:
            ProviderNotConfiguredError: if this provider instance lacks the credentials/
                configuration required to actually perform a completion.
        """
        raise NotImplementedError

    def register_before_tool_call(self, hook: BeforeToolCallHook) -> None:
        """Register a `before_tool_call`-style intervention/hook.

        Only meaningful for providers that actually drive an agentic tool-call loop
        (`bedrock_strands`, via Strands' native `InterventionHandler` /
        `before_tool_call` mechanism — see app/llm/bedrock_strands.py). Slice 5's
        permission gate plugs in here: our app's own policy table is consulted inside
        this hook before any tool executes — the LLM is never trusted to self-police.

        Providers with no tool loop of their own (mock, anthropic-as-bare-client) have
        nothing to intervene on, so the default implementation is a clear error rather
        than a silent no-op — a caller that expects this to actually gate tool calls must
        know immediately if the provider can't honor that.
        """
        raise NotImplementedError(
            f"{self.name} provider does not drive a tool-call loop; "
            "before_tool_call hooks are only meaningful on bedrock_strands."
        )
