# Axiom — Handoff / Status

**Read this first when resuming work in a new session.** Update it at the end of every
work session (or when context is about to run out) so the next agent can pick up cold.
Keep entries terse — this is a status board, not a changelog; `git log` is the changelog.

## How to resume

1. Read this file top to bottom.
2. Read `docs/SDD.md` for the locked architecture/scope.
3. Read `docs/DECISIONS.md` for why non-obvious choices were made (append, don't rewrite).
4. Check "Next up" below and continue from there.
5. Run `git log --oneline -20` to see what actually landed vs. what this doc claims —
   trust the repo over stale notes if they conflict, and fix this doc.

## Current status (2026-09-13)

**Phase: Slice 2 complete** (Slice 1 landing concurrently from a separate agent — check
its own status in this file's history/commits before assuming apps/web is done). Monorepo
scaffold (Slice 0) and LLM provider abstraction (Slice 2) built and verified end-to-end.

### Done
- [x] Plan approved with user (scope: full architecture + seeded data + flagship demo;
      LLM provider abstraction mock/anthropic/bedrock+strands; connector abstraction
      seeded now, live OAuth stubbed).
- [x] `docs/SDD.md` — authoritative spec for this build pass.
- [x] `docs/HANDOFF.md` — this file.
- [x] `docs/SLICES.md` — slice-by-slice build plan (Slices 0-10), for reference each session.
- [x] **Slice 0 — monorepo scaffold + round trip**
- [x] **Slice 2 — LLM provider abstraction** (`apps/agent-service/app/llm/`)
- [x] **Slice 1 — Core entities + seed script + Company Pulse page**
- [x] **Slice 3 — Event system + Observer agent**
- [x] **Slice 4 — State Agent + deterministic trajectory math**
- [x] **Slice 5 — Authority model + permission gate + audit log**
- [x] **Slice 6 — Strategist + Operator agents, Tasks, and approvals UI**
- [x] **Slice 7 — Verifier + Memory Agent + Decisions/Memory UI**
- [x] **Slice 8 — Connectors (seeded) for Gmail/Slack/Calendar/Drive/GitHub**
- [x] **Slice 9 — Scenario Engine + NL command bar**:
  - `apps/agent-service/app/scenario_engine.py`: `ScenarioEngine` evaluating counterfactual developer hiring options (Option A: Hire now vs Option B: Wait 3 months post-Nimbus contract) with deterministic runway math.
  - `apps/agent-service/app/main.py`: Exposed `POST /scenario/evaluate` endpoint.
  - `apps/agent-service/tests/test_scenario_engine.py`: Unit test suite (28 tests passing).
  - `apps/web/app/scenarios/page.tsx`: Counterfactual Scenarios UI screen rendering option deltas, LLM recommendation, and trigger conditions.

### In progress
- [ ] Flagship demo hardening + remaining nav placeholders (Slice 10)

### Next up
**Slice 3** (see `docs/SLICES.md`): Event system + Observer agent. `Event` table writable
via a Next.js internal API endpoint (now that Slice 1's Prisma schema has landed). Seed/cron
script pushes synthetic events. Observer agent (agent-service) reads new events, classifies
significance via `app/llm/get_provider()`, writes results back through Next.js's API.
Inbox/Events UI screen lists events with classification.

Slice 5 (permission gate) implementers: read `bedrock_strands.py`'s module docstring and
the DECISIONS.md entry above first — the `before_tool_call` intervention wiring pattern is
already established there; Slice 5 mainly needs to build the actual policy-table-backed
callback and pass it to `register_before_tool_call()`, plus mirror the same enforcement
point for whichever provider ends up live (mock/anthropic have no tool loop to intervene on
— only bedrock_strands genuinely drives one via Strands' `Agent`).

### Verification status (Slice 0, this session)
Verified:
- `pnpm install` at repo root — succeeded (network/registry access was available).
- `pnpm --filter web typecheck` — clean, no errors.
- `pnpm --filter web build` — succeeded (`next build`, static + dynamic routes generated).
- `pnpm --filter web lint` — no ESLint warnings/errors.
- `pnpm --filter @axiom/shared-types typecheck` — clean.
- `apps/agent-service`: `uv sync` succeeded; started `uvicorn` and confirmed
  `GET /health` returns 401 without the `X-Axiom-Internal-Secret` header and
  `{"status":"ok"}` (200) with the correct header.
- Full round trip: started both dev servers (agent-service on port 8001, web on port 3100
  — ports 3000/8000 were occupied by unrelated local services in this dev environment, so
  the verification run used alternate ports; defaults in code/`.env.example` are still
  3000/8000 as specified), curled `/` on web and confirmed it rendered
  `agent-service: ok`. Then stopped agent-service and re-curled `/`, confirmed it rendered
  the error state (`agent-service: unreachable (...)`). Both dev servers stopped after
  verification.

Not verified / worth double-checking next session:
- Default ports 3000 (web) and 8000 (agent-service) specifically — verification used 3100/
  8001 because something else was already listening on 3000/8000 in this sandbox. The code
  has no hardcoded port assumptions (Next.js defaults to 3000, uvicorn command in
  `run.sh` defaults to 8000), so this should be a non-issue on a clean machine, but
  hasn't been directly observed.
- `docker-compose.yml` was not actually brought up this session (Postgres/Redis aren't
  wired into either app yet, so there was nothing to verify against it) — worth a
  `docker compose up -d` sanity check before Slice 1 starts depending on it.
- No `uv`-vs-`pip` fallback path in `run.sh` was exercised (this environment has `uv`
  installed, so only that path ran).

## Key decisions (see docs/DECISIONS.md for full rationale)

- Split web (Next.js/Prisma, owns state) from agent-service (Python/Strands, stateless) —
  Strands Agents is Python-only; single DB owner avoids schema duplication.
- LLM provider auto-detects: bedrock (if AWS creds) → anthropic (if ANTHROPIC_API_KEY) → mock.
- Integrations ship seeded-data-only this pass; live connector classes exist but raise
  `NotConfiguredError` until OAuth is wired.
- GateGuard fact-forcing hook is active this session (user asked to disable it but the
  hook reads env at CLI-launch time, not changeable mid-session) — first Write/Edit to
  each new file gets denied once, then the retry succeeds automatically since the path is
  marked checked on denial. Don't loop on it; just retry once.

## Environment / secrets

- `ANTHROPIC_API_KEY` — **correction from Slice 0's assumption**: as of Slice 2, this key
  is NOT actually present in this dev environment (checked shell env and every `.env`
  location; none found). The `anthropic` provider is fully implemented and will work the
  moment a real key is set — no code changes needed — but it has only been verified
  structurally (`ProviderNotConfiguredError` path) here, not against a live response.
  `@pytest.mark.integration` tests in `test_llm_provider.py` will start actually running
  (rather than skipping) the moment the key exists.
- AWS credentials — **not yet provided**. `bedrock_strands` provider is fully implemented
  but inert until `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or a profile) + `AWS_REGION`
  are set. Verified in Slice 2: importing/instantiating the provider and calling
  `register_before_tool_call()` never raises without creds; `complete()` raises typed
  `ProviderNotConfiguredError` (also verified live through `POST /llm/complete` with
  `LLM_PROVIDER=bedrock_strands` forced — clean HTTP 503, not a crash). No code changes
  should be needed when the user adds AWS creds — only the actual network round trip to
  Bedrock remains unverified in this environment.
- No OAuth client IDs/secrets configured for Gmail/Slack/Calendar/Drive/GitHub — live
  connectors are stubs by design.
