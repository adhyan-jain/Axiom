# Product Specification: Axiom

> Generated from: `docs/SDD.md` (locked v0.1 scope) + `docs/DECISIONS.md` (append-only
> decision log), both dated 2026-09-13. This file stands in for what `gan-planner` would
> normally produce — the SDD is already the product spec, this translates it into the
> vertical-slice / sprint shape the Generator/Evaluator loop expects. Do not re-plan
> product scope from scratch; SDD.md and DECISIONS.md are the source of truth and this
> file must stay consistent with them. If they conflict, SDD.md + DECISIONS.md win — fix
> this file, not the other way around.

## Vision

Axiom is an agentic operating system for solo founders and 1-5 person startups. It keeps
a continuously updated model of the company (the "Company Brain") and actively helps move
it toward its goals: observe events, understand consequences, compare against goals, plan,
execute safe actions, ask for human authority when required, verify, update memory, replan.
It is explicitly not a chatbot, not Notion+AI, not a CRM/task-manager skin — the differentiator
is a living, causal model of the company plus a real permission/authority boundary around
agent action.

## Design Direction

This is a founder-facing operations console, not a consumer app — the visual bar is
"trustworthy financial/ops software," not "flashy AI-slop landing page." Evaluator should
weight craft/functionality far above originality-for-its-own-sake.

- **Tone**: dense, information-forward dashboard (Linear/Mercury/Ramp register), not an
  airy marketing page. Numbers and state changes are the content.
- **Visual identity**: every proactive agent output (event, task, recommendation) is a
  card with explicit `[Approve] [Reject] [Investigate]` actions and a visible link to its
  `AuditLogEntry` — this traceability affordance is the one non-negotiable design element,
  present on every screen that surfaces agent output.
- **Anti-slop directives**: no generic gradient hero sections, no stock illustrations, no
  decorative AI-pattern SVGs anywhere in this product — it is a serious tool for someone's
  company finances and authority delegation.
- **States**: every data view must render loading/empty/error states — especially "seeded
  demo mode" badges on connector-derived data (Integration.mode = seeded), which must be
  visually distinct from anything claiming to be live.

## Locked Architecture (do not deviate — see docs/DECISIONS.md for the "why" of each)

### Monorepo layout
```
apps/
  web/              Next.js 14 (App Router) + TypeScript + Tailwind. Owns ALL durable
                     state via Prisma/Postgres. Internal API routes are the only way
                     agent-service touches state.
  agent-service/    Python FastAPI. Multi-agent orchestration (Strands Agents). LLM
                     provider abstraction. STATELESS — no direct DB access, ever;
                     every read/write goes through apps/web's internal API.
packages/
  shared-types/     Shared TS types for entities & events (single source for the wire
                     contract between web and agent-service).
```
Background jobs: Redis + BullMQ from Next.js API routes/cron; workers call agent-service
HTTP endpoints per agent step.

### LLM provider abstraction (`agent-service/app/llm/`)
`LLMProvider` interface with three implementations, selected by `LLM_PROVIDER` env var,
else auto-detect (bedrock if AWS creds present → anthropic if `ANTHROPIC_API_KEY` present →
else mock):
- `MockProvider` — deterministic canned responses, for tests/offline dev.
- `AnthropicProvider` — real LLM, runs today, no AWS needed.
- `BedrockStrandsProvider` — AWS Strands Agents + Bedrock runtime. **Must be a fully
  implemented code path, not a placeholder.** It must work the moment AWS credentials are
  supplied — gated on credential presence, not a TODO or a `NotImplementedError`.

### Connector abstraction (`agent-service/app/connectors/`)
`EmailConnector`, `SlackConnector`, `CalendarConnector`, `DriveConnector`, `GitHubConnector`.
Each has:
- A `SeededConnector` implementation backed by realistic fixture JSON under
  `connectors/fixtures/`, UI-labeled as demo mode (`Integration.mode = "seeded"`).
- A `LiveConnector` implementation stubbed for OAuth — must raise `NotConfiguredError`
  (a real, typed exception) until wired, never silently no-op or return fake success.

### Agent roster (`agent-service/app/agents/`)
Observer, State Agent, Strategist, Operator, Verifier, Memory Agent. (Researcher /
Compliance / Planner responsibilities are folded into Strategist+Operator for this pass —
documented as a future split, not built as separate agents now.)

Core loop, one event through the system:
1. Seed script/cron pushes a synthetic `Event` via Next.js API.
2. **Observer** classifies event significance.
3. **State Agent** updates canonical entities (revenue, runway) via Next.js API.
4. **Strategist** compares state against Goal/Milestone trajectory, finds the bottleneck.
5. **Operator** proposes/executes `Task`s and tool actions, gated by the permission table.
6. **Verifier** re-reads resulting state to confirm success — never trusts the tool call's
   own return value.
7. **Memory Agent** writes `Decision`/episodic records; checks new events against active
   Decisions for conflicts and surfaces them.
8. UI (Inbox/Events, Actions, Company Pulse) shows proactive cards with
   `[Approve] [Reject] [Investigate]`.

### Authority / permission model — the most important invariant in this build
`Permission` enum: `READ, DRAFT, RECOMMEND, EXECUTE, REQUIRE_APPROVAL`, scoped per
action-type per org.

- **Strands owns the agentic tool-call loop; it never owns authority.** Layering is:
  `Company Brain → trajectory/planning → policy/authorization → Strands Agent →
  tool invocation → execution → verification → state update`. Strands genuinely drives
  reasoning and tool selection — it is not reduced to a bare LLM client — but it is never
  the source of truth for user authority, business state, approval persistence, or
  authorization policy.
- **Enforcement is a Strands hook, not a prompt.** The permission table is enforced via a
  Strands `before_tool_call`-style intervention that checks the policy table against
  every proposed tool invocation *before* it executes. An Operator tool call above its
  allowed level must produce an `ApprovalRequest` instead of executing — this must be
  impossible to bypass by prompting the agent to "just do it," because the check happens
  in the hook layer, not the model.
- **Approval-replay-with-staleness-check semantics**: on block, persist the exact proposed
  tool invocation *plus* the company-state version it was proposed against. On approval,
  replay that exact persisted invocation — never re-run the agent's reasoning from
  scratch. If the referenced state version has changed since the block, invalidate the
  approval and require re-approval rather than executing against stale state.
- **Verification is independent**: after execution, the Verifier re-reads resulting state
  before Company Brain is considered updated. It never trusts the tool call's own return
  value as proof of success.
- **Audit log on every tool call, regardless of outcome.** Every agent tool call — success,
  failure, blocked-pending-approval, rejected — writes an `AuditLogEntry`: timestamp, agent,
  action, tool, input, output, evidence refs, authorization decision, result, verification
  status. This is not optional logging; it is the mechanism by which a founder can trust
  the system enough to delegate to it. No code path that calls a tool may skip this.

### Trajectory / scenario engine — deterministic math, LLM narrates only
Runway, burn, ARR-vs-goal delta, and scenario (e.g. hire-or-wait) deltas are computed by
plain deterministic functions (e.g. `runwayMonths = cash / avgMonthlyBurn`) — **never** by
asking the LLM to do arithmetic. The LLM's role is narration, bottleneck framing, and
recommending between already-computed options, never fabricating the numbers themselves.
This matches the anti-hallucination stance: never let the LLM fabricate evidence.

## Data Model (representative entities — Prisma schema in apps/web is the source of truth)

```
Organization → Goal → Milestone
Customer → Deal → Contract → Invoice → CashEvent
Expense/Subscription → BurnSnapshot → RunwaySnapshot
Asset
ComplianceItem   (confidence, sourceUrl, lastChecked, status: verified|inferred|recommended)
Decision         (title, reason, date, reviewDate, status, conflictsWith)
Event            (source, entityRef, previousState, newState, confidence, evidence[])
Task             (why, impact, source, priority)
Integration      (provider, mode: seeded|live, status)
AuditLogEntry
ApprovalRequest
```
Full Prisma schema at `apps/web/prisma/schema.prisma` is authoritative; this file is a map,
not the contract — if they disagree, the Prisma schema wins.

## UI (this pass)

Home/Company Pulse, Company Brain, Goals/Trajectories, Inbox/Events, Actions, Finance,
Agent Activity/Audit Log, Decisions/Memory, Scenarios, Settings/Permissions, plus a
natural-language Command Bar grounded in Company Brain via agent-service. All other
screens from the long-term spec (Customers, Assets, Compliance, Documents, dedicated
Integrations screen) are **nav placeholders only** — do not build fake-functional versions
of them; a placeholder that looks real but does nothing is worse than an honest "not yet."

## Out of scope for this pass (do not build, do not stub as if built)

Browser/computer-use automation, live government compliance research, billing, and the
~12 UI screens beyond the list above. These should be architecturally extensible (e.g. the
connector/agent interfaces don't preclude adding them) but must not appear as working
features anywhere in the UI or docs.

## Vertical Slices (build order — thin end-to-end paths, not all-models-then-all-views)

Each slice below is a `/gan-build "<brief>" --skip-planner` unit. Use `--eval-mode
code-only` for slices with no browser-observable surface (0-3, 6), `--eval-mode playwright`
once there's a UI to click through (4-5, 7-10). Every slice must leave the app in a
runnable, demoable state — no slice may depend on a later slice to not be visibly broken.

### Slice 0 — Repo & service scaffold
- pnpm workspaces (`apps/web`, `apps/agent-service`, `packages/shared-types`) boot cleanly.
- `docker-compose.yml` brings up Postgres + Redis.
- Next.js app renders a placeholder shell with nav for all screens in §UI (real screens
  built later; unimplemented ones are honest placeholders, not broken links).
- FastAPI app boots with a health check endpoint.
- Definition of done: `pnpm dev` (or documented equivalent) starts both services against
  docker-compose infra with no errors.

### Slice 1 — Core entities, seed script, Company Pulse skeleton
- Prisma schema for Organization, Goal, Milestone, Customer, and the finance chain
  (Deal → Contract → Invoice → CashEvent, Expense/Subscription → BurnSnapshot →
  RunwaySnapshot).
- Seed script creates one org, one founder, seed goal (₹10L ARR), current state
  (₹2.4L ARR, cash, burn).
- Company Pulse screen reads real seeded data (no hardcoded UI numbers).
- Definition of done: seed script is idempotent/rerunnable; Pulse screen shows seeded
  numbers pulled from the DB, not literals in JSX.

### Slice 2 — LLM provider abstraction
- `LLMProvider` interface + `MockProvider`, `AnthropicProvider`, `BedrockStrandsProvider`
  in `agent-service/app/llm/`.
- Env-var + auto-detect selection logic, unit-tested for all three precedence branches.
- `BedrockStrandsProvider` is real code (Strands Agents + Bedrock runtime wiring), not a
  stub — verified by reading the implementation, not just its presence.
- Definition of done: a script/test can force each provider and get a real (or
  deterministically mocked) completion; Bedrock path fails with a clear
  credentials-missing error today, not a `NotImplementedError`.

### Slice 3 — Observer + State Agent on one real event
- `Event` table + Next.js API endpoint to push events.
- Observer agent (in agent-service, via the LLM abstraction) classifies one event's
  significance.
- State Agent updates a canonical entity (e.g. RunwaySnapshot) via Next.js's internal API
  — agent-service never touches Postgres directly.
- Definition of done: pushing one seeded event end-to-end visibly changes a DB-backed
  number the UI reads.

### Slice 4 — Audit log + Agent Activity screen
- `AuditLogEntry` table capturing every tool call regardless of outcome.
- Every agent-service tool invocation from Slice 3 onward writes an entry.
- Agent Activity/Audit Log screen lists entries with filters (agent, action, result).
- Definition of done: triggering the Slice 3 event produces a visible, correct audit row
  in the UI within the same demo flow.

### Slice 5 — Permission gate + approvals + inbox
- `Permission` enum + per-org per-action-type policy table.
- Strands `before_tool_call`-style hook enforcing the table — an over-authority tool call
  creates an `ApprovalRequest` instead of executing (test this negative path explicitly).
- Approval persists the exact tool invocation + company-state version proposed against.
- Approve → replay persisted invocation (not re-run agent reasoning); stale state version
  → invalidate and require re-approval (test this explicitly, not just the happy path).
- Inbox/Events + Actions screens with `[Approve] [Reject] [Investigate]` cards.
- Definition of done: an Operator action above its permission level visibly blocks,
  appears in Inbox, and only executes after explicit approval; a staleness test proves
  re-approval is required after state changes underneath a pending approval.

### Slice 6 — Seeded connectors + ingestion
- `EmailConnector`, `SlackConnector`, `CalendarConnector`, `DriveConnector`,
  `GitHubConnector` interfaces, each with `SeededConnector` (fixture JSON) + `LiveConnector`
  stub raising `NotConfiguredError`.
- `Integration` records with `mode: seeded|live` driving a visible "demo mode" badge.
- At least one connector's seeded data feeds a real `Event` into the Slice 3 pipeline.
- Definition of done: switching a connector's live/seeded mode is a real code path
  decision (env/config), not a UI toggle with no backend meaning.

### Slice 7 — Flagship demo part 1: contract → invoice → runway → trajectory
- Seeded ₹2L contract event → invoice + onboarding tasks generated.
- Revenue/runway recompute via the deterministic trajectory math (not LLM arithmetic).
- Strategist replans trajectory against the ₹10L ARR goal and surfaces the bottleneck.
- Definition of done: this is demo step 1 from SDD §8, fully clickable, with a visible
  `AuditLogEntry` per step.

### Slice 8 — Flagship demo part 2: AWS anomaly + Decisions/Memory
- Seeded AWS cost spike event → investigated → recommendation surfaced via Operator.
- Memory Agent writes a Decision record and checks it against prior active Decisions for
  conflicts, surfacing any found.
- Decisions/Memory screen shows the record with reason/status/conflictsWith.
- Definition of done: this is demo step 2 from SDD §8, fully clickable, with a visible
  `AuditLogEntry` per step.

### Slice 9 — Command bar + scenario engine
- NL command bar grounded in Company Brain via agent-service.
- "Should I hire a developer next month?" → Scenario Engine computes Option A/B (runway
  deltas via deterministic math) + LLM-narrated recommendation + trigger condition.
- Definition of done: this is demo step 3 from SDD §8, fully clickable.

### Slice 10 — Company Brain, Settings/Permissions polish, demo script
- Company Brain screen aggregating the entities above into one coherent view.
- Settings/Permissions screen for editing the per-action-type permission table (with the
  Slice 5 hook actually reading from it, not a parallel hardcoded table).
- All nav placeholders from Slice 0 confirmed still honest (no fake-functional drift).
- A written, rehearsable demo script walking all three SDD §8 flagship steps end-to-end.
- Definition of done: a cold run of the seed script + the demo script produces the full
  flagship scenario with visible audit trail, permission gate, and trajectory replan.

## Technical Stack
- Frontend/API: Next.js 14 (App Router), TypeScript, Tailwind, Prisma, Postgres.
- Agent service: Python, FastAPI, Strands Agents SDK, Bedrock runtime client.
- Jobs: Redis + BullMQ.
- Shared contracts: `packages/shared-types` (TS), mirrored intentionally (not
  code-generated) into agent-service's Pydantic models — document any drift risk.

## Evaluation Criteria

See `gan-harness/eval-rubric.md` for the full per-slice weighted rubric. Summary: this
project is scored on architectural fidelity to the locked decisions above (not generic
app quality), end-to-end demoability of the slice's scope, code-quality baseline
(types/tests/error handling), and — critically — absence of fake/stubbed functionality
presented as real.
