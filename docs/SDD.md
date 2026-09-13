# Axiom — System Design Document

Status: locked scope for v0.1 (flagship demo pass). Source: user's master build prompt
("Founder Trajectory & Company Brain") + scoping decisions made in planning session on 2026-09-13.
See `docs/HANDOFF.md` for live build status — read that first if resuming work.

## 1. Product vision

An agentic operating system for solo founders / 1-5 person startups. It maintains a
continuously updated model of the company (the "Company Brain") and actively helps move
it toward its goals. Core loop:

```
CURRENT STATE → OBSERVE → DETECT CHANGES → UNDERSTAND CONSEQUENCES → COMPARE AGAINST GOALS
→ PLAN → EXECUTE SAFE ACTIONS → REQUEST HUMAN AUTHORITY WHEN REQUIRED → VERIFY
→ UPDATE MEMORY + STATE → REPLAN
```

Not a chatbot, not Notion+AI, not a task manager/CRM/accounting dashboard. Central concept:
a living model of the company that understands where it is, where it wants to go, what
changed, what those changes affect, and what should happen next — and increasingly, whether
it can just handle it.

## 2. Locked scope decisions for this build pass

1. **Depth over breadth**: build the full architecture (data model, event system,
   multi-agent core loop, permission/authority model, audit log) for real, wired to
   **seeded/demo data**, with the flagship end-to-end demo scenario (§8 below) fully
   working. Remaining UI screens exist as scaffolded nav placeholders, not fake-functional.
2. **LLM layer**: a provider abstraction (`mock` / `anthropic` / `bedrock_strands`)
   selectable via env var, auto-detecting Bedrock credentials when present. `bedrock_strands`
   must be a fully implemented code path (AWS Strands Agents + Bedrock runtime), not a
   placeholder — it should just work the moment AWS creds are supplied. Runs today against
   the `anthropic` provider (a real LLM, no AWS needed yet).
3. **Integrations**: real connector interfaces for Gmail, Slack, Calendar, Drive, GitHub,
   each with a `Seeded` implementation (realistic fixture data, UI-labeled demo mode) and a
   `Live` implementation stubbed for OAuth (raises `NotConfiguredError` until wired).
4. Explicitly out of scope for this pass: browser/computer-use automation, live government
   compliance research, billing, and the remaining ~12 of 15 UI screens beyond what's listed
   in §7 — all architected for extensibility, not built.

## 3. Architecture

Monorepo (pnpm workspaces):

```
apps/
  web/              Next.js 14 (App Router) + TypeScript + Tailwind — UI, API routes,
                     Prisma/Postgres (owns ALL durable state)
  agent-service/    Python FastAPI — multi-agent orchestration (Strands Agents), LLM
                     provider abstraction. Stateless — calls back into web's internal API
                     for every read/write. No direct DB access.
packages/
  shared-types/     Shared TS types for entities & events
```

Why the split: Strands Agents is a Python SDK; keeping Next.js as the single owner of
durable state (via Prisma) avoids a duplicated schema and keeps auth/tenancy enforcement
in one place.

- **DB**: Postgres via Prisma in `apps/web`.
- **Background jobs**: Redis + BullMQ from Next.js API routes / cron; workers call
  `agent-service` HTTP endpoints per agent step.
- **LLM provider** (`agent-service/app/llm/`): `LLMProvider` interface, `MockProvider`,
  `AnthropicProvider`, `BedrockStrandsProvider`. Selection: `LLM_PROVIDER` env var, else
  auto-detect (bedrock if AWS creds present, else anthropic if `ANTHROPIC_API_KEY` present,
  else mock).
- **Connectors** (`agent-service/app/connectors/`): `EmailConnector`, `SlackConnector`,
  `CalendarConnector`, `DriveConnector`, `GitHubConnector`. Each: `SeededConnector` (fixture
  JSON under `connectors/fixtures/`) + `LiveConnector` stub.
- **Agents** (`agent-service/app/agents/`): Observer, State Agent, Strategist, Operator,
  Verifier, Memory Agent. Researcher/Compliance/Planner responsibilities folded into
  Strategist+Operator for this pass (documented as a future split).
- **Authority model**: `Permission` enum (`READ, DRAFT, RECOMMEND, EXECUTE,
  REQUIRE_APPROVAL`) per action-type per org, enforced in the tool-calling layer itself
  (not just prompted). An Operator tool call above its allowed level creates an
  `ApprovalRequest` instead of executing.
- **Audit log**: every agent tool call writes an `AuditLogEntry` regardless of outcome
  (timestamp, agent, action, tool, input, output, evidence refs, authorization decision,
  result, verification status).

## 4. Data model (representative entities)

`Organization → Goal → Milestone`
`Customer → Deal → Contract → Invoice → CashEvent`
`Expense/Subscription → BurnSnapshot → RunwaySnapshot`
`Asset`
`ComplianceItem` (confidence, sourceUrl, lastChecked, status: verified|inferred|recommended)
`Decision` (title, reason, date, reviewDate, status, conflictsWith)
`Event` (source, entityRef, previousState, newState, confidence, evidence[])
`Task` (why, impact, source, priority)
`Integration` (provider, mode: seeded|live, status)
`AuditLogEntry`, `ApprovalRequest`

Full Prisma schema is the source of truth — see `apps/web/prisma/schema.prisma`.

## 5. Core loop (implementation)

1. Seed script / cron pushes synthetic events into `Event` table via Next.js API.
2. Observer agent classifies event significance.
3. State Agent updates canonical entities (revenue, runway) via Next.js API.
4. Strategist compares state against Goal/Milestone trajectory, finds the bottleneck.
5. Operator proposes/executes Tasks and tool actions, gated by the permission table.
6. Verifier re-reads resulting state to confirm success (never trusts the tool call's
   return value alone).
7. Memory Agent writes Decision/episodic records; checks new events against active
   Decisions for conflicts and surfaces them.
8. UI (Inbox/Events, Actions, Company Pulse) shows proactive cards with
   `[Approve] [Reject] [Investigate]`.

## 6. Human-authority model

Never let the agent grant itself authority. Permissions configurable per org, per
action-type, enforced server-side in `agent-service`'s tool layer — not by prompting the
LLM to behave. Every action above its authorized level produces an `ApprovalRequest` that
blocks execution until a human approves it via the UI or API.

## 7. UI (this pass)

Home/Company Pulse, Company Brain, Goals/Trajectories, Inbox/Events, Actions, Finance,
Agent Activity/Audit Log, Decisions/Memory, Scenarios, Settings/Permissions. Command bar
(natural-language, grounded in Company Brain via agent-service). Remaining screens from the
full spec (Customers, Assets, Compliance, Documents, Integrations as a dedicated screen) are
nav placeholders for now — data underneath them may partially exist via the entities above,
but no dedicated screen.

## 8. Flagship demo scenario

Seed one org: founder, existing customers, seeded Gmail/Slack/Calendar/Drive/GitHub
fixtures, goal (₹10L ARR), current state (₹2.4L ARR, cash, burn). Demo script:

1. New ₹2L contract event → invoice + onboarding tasks generated, revenue/runway updated,
   trajectory replanned.
2. AWS cost spike event → anomaly investigated → recommendation surfaced.
3. NL command "Should I hire a developer next month?" → Scenario Engine produces Option
   A/B comparison (runway deltas) + recommendation + trigger condition.

Every step must produce visible `AuditLogEntry` rows.

## 9. Full long-term spec (reference, not all in scope now)

The complete 37-section original spec (company brain domains — identity, goals, strategy,
customers, finance, assets, legal/compliance, operations, product, people; company graph;
event system; trajectory engine; counterfactual/scenario engine; decision memory; connected
software — Gmail/Slack/Calendar/Drive/GitHub/Notion-Linear-Jira; browser/computer-use;
government/compliance intelligence; opportunity engine; financial intelligence; asset
management; task management; daily/weekly OS; human-authority model; audit log; agent
architecture; memory layers; provenance; UI/UX principles; command interface; proactive
agent; notification philosophy; multi-tenancy; security; tech stack; implementation
philosophy; demo-first-but-production-minded; startup-level extensibility) lives in the
plan-mode transcript that produced `~/.claude/plans/floofy-roaming-cake.md`. Treat this SDD
(§1-8) as the authoritative scope for actual implementation; the rest is the north-star
product vision to extend toward later, per `docs/HANDOFF.md`'s roadmap section.
