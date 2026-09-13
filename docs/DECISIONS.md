# Axiom — Decision Log

Append-only. One entry per non-obvious call, newest first. Don't rewrite history; if a
decision is reversed, add a new entry noting the reversal and why.

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
