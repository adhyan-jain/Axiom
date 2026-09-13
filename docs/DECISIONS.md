# Axiom — Decision Log

Append-only. One entry per non-obvious call, newest first. Don't rewrite history; if a
decision is reversed, add a new entry noting the reversal and why.

## 2026-09-13 — Strands Agents SDK confirmed real; native InterventionHandler API matches the Gate-1 design exactly
Slice 2 research (installed `strands-agents` 1.55.1 live via `uv add`, then read the
installed source under `.venv/lib/python3.12/site-packages/strands/`, not just docs):
`strands-agents` is a genuinely installable, actively-versioned PyPI package (95+ releases,
latest 1.55.1) with `anthropic`, `boto3`, and `strands-agents-tools` all installing cleanly
alongside it. It ships a first-class `strands.interventions` module:
`InterventionHandler` (ABC, subclass + override class-level lifecycle methods —
`before_invocation`, `before_tool_call`, `after_tool_call`, `before_model_call`,
`after_model_call`) returning typed decisions from `strands.interventions.actions`
(`Proceed`, `Deny`, `Guide`, `Confirm`, `Transform`). The method is *literally* named
`before_tool_call` — not an analogy, Strands' own naming matches the language already used
in this decision log before the SDK was ever installed. `Deny` sets `event.cancel_tool`
and short-circuits remaining handlers; the tool never executes and the denial reason is
delivered to the model as a tool-result error, not a suggestion it can ignore. Handlers
attach via `Agent(interventions=[...])` (a separate, newer mechanism from the older
`hooks=[...]`/`HookProvider` observer-only system). `InterventionHandler.on_error`
(`"throw"` default / `"deny"` / `"proceed"`) controls fail-open vs fail-closed if the
handler itself throws — Slice 5's permission gate must use `"deny"` or `"throw"`, never
`"proceed"`, to preserve the "authority never silently lapses" invariant.
`Agent.structured_output_async(model, prompt)` gives native Pydantic-validated output,
used the same way across all three providers here.
What remains genuinely unverified (no AWS credentials in this dev environment): an actual
live Bedrock model invocation end-to-end. `BedrockModel` construction and `boto3` credential
resolution were exercised and confirmed not to require network access or raise without
creds; the network call itself needs verification once AWS credentials exist.
Why this matters: it means Slice 5's permission gate can be built as real
`InterventionHandler.before_tool_call` code against a real, stable public API — no
adapter-guessing or prompt-based workaround needed. See `apps/agent-service/app/llm/
bedrock_strands.py` for the concrete wiring (including `BedrockStrandsInterventionAdapter`,
a small bridge so a Slice-5-supplied plain callable can be attached as a class-level
`InterventionHandler.before_tool_call` override, which Strands' override-detection
requires).

## 2026-09-13 — Scope: flagship demo depth over feature breadth
Full spec (37 sections) is a multi-year product. Building full architecture (data model,
event system, agent core loop, permissions, audit log) for real, with seeded/demo data,
targeting one fully-working flagship demo scenario rather than shallow coverage of
everything. Rest of the spec is the north-star roadmap, not built yet.
Why: user explicitly chose "Flagship demo loop first" when asked to scope an
otherwise-unbounded spec. See `docs/SDD.md` §2.

## 2026-09-13 — LLM provider abstraction instead of hard Bedrock dependency
Three providers behind one interface: `mock`, `anthropic` (real, usable today), and
`bedrock_strands` (spec-mandated, fully implemented, inert until AWS creds exist).
Why: user has no AWS credentials yet but wants the project "prod level complete" the
moment they're added — so the Bedrock/Strands path can't be a stub, it has to be real
code gated on credential presence, not a TODO.

## 2026-09-13 — Seeded data behind real connector interfaces
Gmail/Slack/Calendar/Drive/GitHub get a real connector interface + a `Seeded`
implementation with fixture data now; `Live` (OAuth) implementations are scaffolded but
raise `NotConfiguredError`.
Why: user chose seeded data to avoid needing OAuth app registration before the core
product logic exists; but wanted the abstraction real so live wiring later is a
credential-supply problem, not a rewrite.

## 2026-09-13 — Strands owns the agent/tool loop; our app owns authority
Architecture layering (Gate 1 clarification):
`Company Brain → trajectory/planning → policy/authorization → Strands Agent →
tool invocation → execution → verification → state update`.
Strands Agents genuinely drives agentic reasoning and the tool-call loop — it is not
reduced to a bare LLM client. But it is never the source of truth for user authority,
business state, approval persistence, or authorization policy. The permission model
(READ/DRAFT/RECOMMEND/EXECUTE/REQUIRE_APPROVAL) is enforced via Strands hooks/interventions
(a `before_tool_call`-style intervention) that check our own policy table before a tool
executes — not by prompting the agent to behave.
Approval resumption: on block, persist the exact proposed tool invocation plus the
company-state version it was proposed against. On approval, replay that exact invocation
(never re-run the agent's reasoning). If the referenced state version has since changed,
invalidate the approval and require re-approval rather than executing against stale state.
After execution, an independent Verifier re-reads resulting state (never trusts the tool
call's return value) before Company Brain is considered updated.
Why: user's explicit correction — reducing Strands to a thin LLM client would under-use
the SDK the spec mandates; but per SDD §6, authority must never live inside the agent.

## 2026-09-13 — Trajectory/scenario math is deterministic; LLM only narrates
Runway, burn, ARR-vs-goal delta, and scenario (hire-or-wait) deltas are computed by plain
deterministic functions (e.g. `runwayMonths = cash / avgMonthlyBurn`), never by asking the
LLM to do arithmetic. The LLM's role is narration, bottleneck framing, and recommending
between already-computed options. Why: reproducibility and trust for a financial feature;
matches SDD §22's anti-hallucination stance ("never let the LLM fabricate evidence").

## 2026-09-13 — apps/web owns all state; apps/agent-service is stateless
Python Strands-Agents service never talks to Postgres directly — it calls back into
Next.js's internal API for every read/write.
Why: avoids maintaining two schemas (Prisma + SQLAlchemy) in sync; keeps tenancy/auth
enforcement in one place.
