# Axiom — Decision Log

Append-only. One entry per non-obvious call, newest first. Don't rewrite history; if a
decision is reversed, add a new entry noting the reversal and why.

## 2026-09-13 — Integration fix: real pipeline wiring, approval-vs-denial distinction, mock-for-this-env

Four real design calls made while fixing the "web never calls agent-service" bug (see
docs/HANDOFF.md's 2026-09-13 entry for the full list of what changed):

1. **`ApprovalRequiredError` vs `PermissionError`**: `check_permission`'s current policy
   semantics set `requires_approval=True` on *every* disallowed case (both explicit
   `REQUIRE_APPROVAL` policy and plain insufficient-level denials) — there is currently no
   policy value that produces a hard, non-escalatable denial. Rather than inventing a new
   policy level to manufacture a hard-deny test case, `AxiomPermissionInterventionHandler.
   before_tool_call` raises `ApprovalRequiredError(gate_result)` whenever
   `gate_result.requires_approval` is true and falls through to plain `PermissionError`
   otherwise — a branch that's currently unreachable via the real policy table but exists
   so a future hard-deny policy type doesn't require changing the handler's contract. This
   matches the "authority never silently lapses" principle literally: today, nothing in
   this app hard-denies without a chance to escalate to a human.

2. **Invoice auto-creation gating lives in web, mirrored from agent-service's hierarchy
   logic**: `OperatorAgent.propose_actions`'s fallback path (exercised under `MockProvider`,
   since its list-field synthesis always returns `[]`) only ever proposes one hardcoded
   onboarding task — there's no "propose an invoice" action in the current agent code. But
   the flagship demo needs a permission decision for invoice creation specifically (to
   demonstrate REQUIRE_APPROVAL). Rather than inventing a new agent-service endpoint or
   forcing invoice creation through the Operator's single-task flow, `apps/web/lib/
   permissionGate.ts` mirrors `permission_gate.py`'s `check_permission` hierarchy
   comparison exactly (same 5-level ordering, same REQUIRE_APPROVAL short-circuit) and is
   used only for this one case, reading the same `Permission` table rows. This is a
   deliberate, narrow, documented duplication of a *pure comparison function* — not a
   second authority — and the file's own docstring says so. If this needs real agent
   reasoning later (not just a level lookup), route it through agent-service instead.

3. **`LLM_PROVIDER=mock` pinned explicitly for this dev environment**: auto-detect already
   resolved to `mock` here (no `ANTHROPIC_API_KEY`, no AWS creds), so this is a
   no-behavior-change, documentation-only pin — added so the choice is visible in `.env`
   rather than an emergent property of what's absent. Not changed in `.env.example`,
   which stays undocumented/auto-detecting for a clean machine.

4. **Server Actions for browser-triggered agent calls, not client `fetch` with the internal
   secret**: `AGENT_SERVICE_SHARED_SECRET` must never reach the browser (see
   `lib/agentServiceClient.ts`'s docstring — "server-only"), but the Inbox/Events page
   needed a real button that triggers `/observer/process`. Rather than adding a second,
   unauthenticated code path into the internal API routes (which would reintroduce a
   fail-open hole), the new "Process with Observer" button calls a Next.js Server Action
   (`apps/web/app/events/actions.ts`) that runs server-side and talks to agent-service
   directly — no HTTP hop through the app's own internal API, no secret exposure. This is
   the same fix `apps/web/components/DemoControls.tsx` would need (it currently fetches
   `/api/demo/run` with no auth header at all and will 401 under the fail-closed fix) but
   that conversion was left as a follow-up — see docs/HANDOFF.md.

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
