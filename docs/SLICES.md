# Axiom — Slice Breakdown

Reference plan for building the flagship demo (docs/SDD.md §8) incrementally. Each slice
should leave the repo in a working, demoable state. This is a reasonable reconstruction
based on docs/SDD.md (the planner's original slice list from the plan-mode transcript that
produced `~/.claude/plans/floofy-roaming-cake.md` was not available verbatim when this file
was written — update it if that transcript resurfaces with a different breakdown).

## Slice 0 — Monorepo scaffold + round trip (done)
pnpm workspace with `apps/web` (Next.js 14 App Router + TypeScript + Tailwind),
`apps/agent-service` (Python FastAPI), and `packages/shared-types`. A health page on
`apps/web` server-fetches `apps/agent-service`'s `/health` endpoint through a shared-secret
internal-auth header (`X-Axiom-Internal-Secret`), proving the two services can talk. Postgres
16 + Redis 7 available via `docker-compose.yml` but not wired in yet.

## Slice 1 — Core entities + seed script + Company Pulse page
Prisma schema in `apps/web` covering the core Company Brain entities from SDD §4
(Organization, Goal, Milestone, Customer, Deal, Expense/Subscription, BurnSnapshot,
RunwaySnapshot, Event, Task, Decision, Integration, AuditLogEntry, ApprovalRequest). Wire
`DATABASE_URL` to the docker-compose Postgres. A seed script creates one demo org (founder,
customers, ₹10L ARR goal, current ₹2.4L ARR/cash/burn state). Home page becomes "Company
Pulse": reads real seeded state via Next.js API routes/server components and renders
ARR-vs-goal, runway, and burn at a glance. No agents yet — this slice is pure data model +
UI-reads-DB.

## Slice 2 — LLM provider abstraction + agent-service skeleton
`agent-service/app/llm/`: `LLMProvider` interface, `MockProvider`, `AnthropicProvider`, and
a fully-implemented (but credential-gated, inert-until-configured) `BedrockStrandsProvider`.
Selection via `LLM_PROVIDER` env var, else auto-detect (bedrock → anthropic → mock). A
trivial agent-service endpoint that round-trips one prompt through the selected provider,
callable from a debug UI control, proves the provider abstraction works end to end.

## Slice 3 — Event system + Observer agent
`Event` table writable via a Next.js internal API endpoint. Seed/cron script pushes
synthetic events (e.g. a new contract signed). Observer agent (agent-service) reads new
events, classifies significance via the LLM provider, and writes results back through
Next.js's API. Inbox/Events UI screen lists events with their classification.

## Slice 4 — State Agent + deterministic trajectory math
State Agent updates canonical entities (revenue, burn, runway) in response to classified
events, calling back into Next.js's API for every write. Runway/burn/ARR-vs-goal delta
computed by plain deterministic functions (never the LLM — see DECISIONS.md), the LLM only
narrates. Company Pulse page reflects live-updated state after an event lands.

## Slice 5 — Authority model + permission gate + audit log
`Permission` enum (READ/DRAFT/RECOMMEND/EXECUTE/REQUIRE_APPROVAL) per action-type per org,
enforced as a Strands `before_tool_call`-style intervention in agent-service's tool layer
(never just prompted). Every agent tool call writes an `AuditLogEntry` regardless of
outcome. Calls above the permission threshold create an `ApprovalRequest` instead of
executing. Agent Activity/Audit Log UI screen renders the trail. Settings/Permissions
screen lets the founder configure the permission table per action-type.

## Slice 6 — Strategist + Operator agents, Tasks, and approvals UI
Strategist agent compares live state against Goal/Milestone trajectory and identifies the
bottleneck; Operator agent proposes/executes Tasks and tool actions gated by Slice 5's
permission table. Actions UI screen shows proactive cards with
`[Approve] [Reject] [Investigate]`; approving replays the exact persisted tool invocation
(never re-runs the agent's reasoning), and invalidates/re-requires approval if the
referenced state version has since changed.

## Slice 7 — Verifier + Memory Agent + Decisions/Memory UI
Verifier agent independently re-reads resulting state after any executed action (never
trusts the tool call's own return value) before Company Brain is considered updated. Memory
Agent writes `Decision` records (title, reason, date, reviewDate, status, conflictsWith)
and checks incoming events against active Decisions for conflicts, surfacing them.
Decisions/Memory UI screen lists decisions and any flagged conflicts.

## Slice 8 — Connectors (seeded) for Gmail/Slack/Calendar/Drive/GitHub
Real connector interfaces in `agent-service/app/connectors/` — `EmailConnector`,
`SlackConnector`, `CalendarConnector`, `DriveConnector`, `GitHubConnector` — each with a
`SeededConnector` implementation reading fixture JSON (`connectors/fixtures/`) and a
`LiveConnector` stub that raises `NotConfiguredError` until OAuth is wired. Observer/
Operator agents start consuming seeded connector data as event sources / action targets.

## Slice 9 — Scenario Engine + NL command bar
Deterministic counterfactual engine (e.g. hire-or-wait: runway deltas for Option A vs
Option B) invoked via a natural-language command bar grounded in the Company Brain through
agent-service. LLM frames the options and recommends between them; math stays deterministic
per DECISIONS.md. Scenarios UI screen shows the comparison + recommendation + trigger
condition (SDD §8 step 3 of the flagship demo).

## Slice 10 — Flagship demo hardening + remaining nav placeholders
Wire the full three-step flagship demo script (SDD §8) end-to-end with visible
`AuditLogEntry` rows at every step: (1) new ₹2L contract → invoice + onboarding tasks +
revenue/runway update + trajectory replan, (2) AWS cost spike → anomaly investigated →
recommendation surfaced, (3) NL "Should I hire a developer next month?" → Option A/B
comparison + recommendation + trigger condition. Remaining SDD §7 UI screens (Company
Brain, Goals/Trajectories, Finance) get real data wiring where entities already exist;
screens beyond §7's list stay nav placeholders per SDD §2.4.
