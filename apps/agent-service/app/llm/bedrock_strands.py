"""Real Strands Agents + AWS Bedrock provider.

Research findings (Slice 2, verified live in this environment — not inferred from docs):
`strands-agents` is a genuinely installable PyPI package (`pip install strands-agents`,
latest verified here: 1.55.1) with a first-class, fully public intervention API that
matches the Gate-1 architecture decision in docs/DECISIONS.md almost exactly:

- `strands.interventions.InterventionHandler` — an ABC you subclass; override the
  lifecycle methods you care about (`before_tool_call`, `after_tool_call`,
  `before_invocation`, `before_model_call`, `after_model_call`) at class level. Each
  override receives a typed event (`BeforeToolCallEvent` etc., from
  `strands.hooks.events`) and returns a typed action: `Proceed`, `Deny`, `Guide`,
  `Confirm`, or `Transform` (from `strands.interventions.actions`).
- This is real interception of the tool-call loop, not prompt engineering: `Deny` sets
  `event.cancel_tool` and short-circuits remaining handlers; a denied tool call never
  executes, and the denial reason is what the model sees (as a tool-result error), not a
  suggestion the model can ignore.
- `Agent(interventions=[...])` is how handlers attach (alongside the separate, older
  `hooks=[...]` mechanism for `HookProvider`/`HookRegistry`-style observers — interventions
  are the newer, decision-returning layer; hooks are the older side-effect-only layer).
  Slice 5's permission gate should use `InterventionHandler.before_tool_call`, per
  DECISIONS.md's "before_tool_call-style intervention" language — this is not a loose
  analogy, Strands' own naming is literally `before_tool_call`.
- `InterventionHandler.on_error` controls fail-open vs fail-closed behavior if the handler
  itself throws (`"throw"` default = fail-closed/blocks; `"deny"` = fail-closed; `"proceed"`
  = fail-open). Slice 5 should very deliberately choose `"deny"` or `"throw"`, never
  `"proceed"`, for the authority gate — a broken policy check must not silently stop
  enforcing.
- `strands.models.bedrock.BedrockModel` wraps `boto3` Bedrock Runtime; constructing it does
  not itself validate credentials (boto3 lazily resolves credentials on first call), so
  credential validation here is done explicitly via `boto3.Session().get_credentials()`
  rather than relying on construction to fail.
- `Agent.structured_output_async(output_model, prompt)` gives native Pydantic-schema-
  validated output — used here for the `schema` path, same anti-hallucination contract as
  the other providers.

Everything above was confirmed by installing the real package and inspecting
`strands/interventions/{handler,actions}.py` and `strands/hooks/events.py` in this
session — not guessed from documentation. The one thing genuinely UNVERIFIED (no AWS
credentials in this environment): an actual live Bedrock model invocation. The request/
response wiring below follows the installed SDK's real, type-checked public signatures,
but has only been exercised up to the point where boto3 would make a network call — that
network call itself needs verification in an environment with real AWS credentials.
"""

from __future__ import annotations

import os
from typing import Any, TypeVar

from pydantic import BaseModel

from app.llm.base import BeforeToolCallHook, CompletionResult, LLMProvider, ProviderNotConfiguredError

SchemaT = TypeVar("SchemaT", bound=BaseModel)

DEFAULT_BEDROCK_MODEL_ID = "global.anthropic.claude-sonnet-4-6"


def _aws_credentials_available() -> bool:
    """Check for AWS credentials without making a network call.

    Checks, in order: explicit access-key env vars, `AWS_PROFILE`, and boto3's own
    credential resolution chain (which also covers instance/container roles, SSO cache,
    shared config files, etc). All of this is local/offline — no request is made.
    """
    if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        return True
    if os.environ.get("AWS_PROFILE") or os.environ.get("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"):
        return True
    try:
        import boto3

        session = boto3.Session()
        creds = session.get_credentials()
        return creds is not None
    except Exception:
        return False


class BedrockStrandsInterventionAdapter:
    """Wraps a plain `before_tool_call`-style callable as a Strands `InterventionHandler`.

    Kept separate from `BedrockStrandsProvider` so later slices (Slice 5) can register a
    policy-table-backed callback without needing to know Strands' class-level-override
    detection rules (`InterventionHandler` only detects overrides defined at class
    definition time, not instance-assigned attributes — this adapter exists precisely to
    bridge a runtime-supplied callable into that class-level-override shape).
    """

    def __init__(self, hook: BeforeToolCallHook, handler_name: str = "axiom-authority-gate") -> None:
        from strands.interventions import InterventionHandler, Proceed

        self._hook = hook
        self._handler_name = handler_name
        self._Proceed = Proceed

        outer = self

        class _Adapter(InterventionHandler):
            name = handler_name
            # Fail-closed by default: a broken policy check must block, never silently
            # allow, per docs/DECISIONS.md's authority invariant.
            on_error = "deny"

            def before_tool_call(self, event):  # type: ignore[override]
                result = outer._hook(event)
                return result if result is not None else outer._Proceed()

        self._instance = _Adapter()

    @property
    def instance(self) -> Any:
        return self._instance


class BedrockStrandsProvider(LLMProvider):
    """Strands Agents driving Claude via AWS Bedrock.

    Inert without AWS credentials: constructing this class NEVER raises (so the rest of
    the app can safely import/reference/select it at any time — e.g. for
    provider-selection logic and tests). Only `complete()` (actual use) raises
    `ProviderNotConfiguredError`, with a clear typed message, when credentials are absent.
    """

    name = "bedrock_strands"

    def __init__(self, model_id: str = DEFAULT_BEDROCK_MODEL_ID, region_name: str | None = None) -> None:
        self._model_id = model_id
        self._region_name = region_name or os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
        self._before_tool_call_hooks: list[BeforeToolCallHook] = []
        # Deliberately no boto3/strands.Agent construction here — importing this module
        # and instantiating this provider must never touch AWS or raise, even with zero
        # credentials configured. All of that is deferred to `complete()`.

    def register_before_tool_call(self, hook: BeforeToolCallHook) -> None:
        """Register a `before_tool_call`-style intervention (Slice 5's permission gate).

        Stored and attached to the Strands `Agent` at completion time as a real
        `InterventionHandler.before_tool_call` override — never as a prompt instruction.
        """
        self._before_tool_call_hooks.append(hook)

    def _require_configured(self) -> None:
        if not _aws_credentials_available():
            raise ProviderNotConfiguredError(
                self.name,
                "No AWS credentials found (checked AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, "
                "AWS_PROFILE, and boto3's default credential chain). Set AWS credentials to "
                "use the bedrock_strands provider.",
            )

    def _build_agent(self, system_prompt: str | None) -> Any:
        """Construct a real `strands.Agent` wired to Bedrock, with any registered
        `before_tool_call` hooks attached as genuine Strands interventions.
        """
        from strands import Agent
        from strands.models.bedrock import BedrockModel

        model = BedrockModel(model_id=self._model_id, region_name=self._region_name)

        interventions = [
            BedrockStrandsInterventionAdapter(hook).instance for hook in self._before_tool_call_hooks
        ]

        return Agent(
            model=model,
            system_prompt=system_prompt,
            interventions=interventions or None,
        )

    async def complete(
        self,
        prompt: str,
        schema: type[SchemaT] | None = None,
        **kwargs: Any,
    ) -> CompletionResult:
        self._require_configured()

        system_prompt = kwargs.pop("system_prompt", None)
        agent = self._build_agent(system_prompt)

        if schema is None:
            result = await agent.invoke_async(prompt)
            text = str(result)
            return CompletionResult(text=text, structured=None, provider=self.name, model=self._model_id)

        structured = await agent.structured_output_async(schema, prompt)
        return CompletionResult(
            text=structured.model_dump_json(),
            structured=structured,
            provider=self.name,
            model=self._model_id,
        )
