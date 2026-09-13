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
- [x] **Slice 0 — monorepo scaffold + round trip**:
  - pnpm workspace: `apps/web` (Next.js 14 App Router + TS + Tailwind),
    `apps/agent-service` (Python FastAPI, `uv`-managed with a `requirements.txt` fallback),
    `packages/shared-types` (scaffolded, placeholder type only).
  - `apps/web`'s `/` page ("Hello Company") server-fetches `apps/agent-service`'s
    `GET /health` and renders live status (ok / unreachable), via
    `apps/web/lib/agentServiceClient.ts`.
  - Shared-secret internal-auth convention established for all future web<->agent-service
    calls: header `X-Axiom-Internal-Secret`, sent by `agentServiceFetch()` in
    `apps/web/lib/agentServiceClient.ts`, validated by the `require_internal_secret`
    FastAPI dependency in `apps/agent-service/app/auth.py`. Env vars:
    `AGENT_SERVICE_URL`, `AGENT_SERVICE_SHARED_SECRET` (see root `.env.example`).
  - `docker-compose.yml` at repo root: Postgres 16 + Redis 7, available but not wired into
    either app yet (starts Slice 1).
  - Root `package.json` workspace scripts (`dev`, `build`, `typecheck`, `lint` →
    `apps/web`; `agent-service:dev` → `apps/agent-service/run.sh`).
  - Root `.gitignore`, `README.md`, `.env.example` (documents all env vars introduced so
    far, plus placeholders for `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `AWS_*`).
  - git initialized, first commit made: `feat: scaffold monorepo (slice 0)`.

- [x] **Slice 2 — LLM provider abstraction** (`apps/agent-service/app/llm/`):
  - `base.py`: `LLMProvider` ABC — `complete(prompt, schema=None, **kwargs) ->
    CompletionResult` (Pydantic-validated `structured` field, never free-text parsing, per
    SDD §22), plus `register_before_tool_call()` hook-registration surface for Slice 5.
  - `mock.py`: `MockProvider` — deterministic (sha256-of-prompt-seeded), zero network calls
    (test asserts this by breaking `socket.socket` and confirming it still works).
  - `anthropic_provider.py`: `AnthropicProvider` — real Anthropic Messages API calls;
    structured output via a forced tool-use call validated back through the Pydantic
    schema (not regex/substring parsing).
  - `bedrock_strands.py`: `BedrockStrandsProvider` — real `strands-agents` `Agent` wired to
    `strands.models.bedrock.BedrockModel`; genuinely inert without AWS creds (construction
    never raises; `complete()` raises typed `ProviderNotConfiguredError`, verified via
    both a pytest test and a live `/llm/complete` HTTP call with `LLM_PROVIDER=
    bedrock_strands` forced and no AWS creds present — got a clean 503, not a crash).
    Exposes `register_before_tool_call()`, which attaches a real
    `strands.interventions.InterventionHandler.before_tool_call` override at completion
    time (via a small `BedrockStrandsInterventionAdapter` bridge — Strands only detects
    class-level overrides, not instance-assigned callables) — this is the literal
    attachment point Slice 5's permission gate will use.
  - `config.py`: `resolve_provider_name()` / `build_provider()` / `get_provider()` — env
    var `LLM_PROVIDER` wins if set, else auto-detect bedrock_strands (AWS creds present) ->
    anthropic (`ANTHROPIC_API_KEY` present) -> mock.
  - `schemas.py`: small named-schema registry (`echo`, `sentiment`) for the debug endpoint.
  - `POST /llm/complete` on `app/main.py` (internal-secret protected like `/health`):
    `{prompt, schema_name?, system_prompt?}` -> `{text, structured?, provider, model}`;
    `ProviderNotConfiguredError` surfaces as HTTP 503 with the typed error message.
  - Added real deps: `strands-agents`, `strands-agents-tools`, `anthropic`, `boto3` (both
    `pyproject.toml`/`uv.lock` and the `requirements.txt` fallback).
  - Tests: `apps/agent-service/tests/test_llm_provider.py` — 15 passed, 2 skipped (the
    `@pytest.mark.integration` live-Anthropic tests skip cleanly; no `ANTHROPIC_API_KEY` in
    this environment — see "Environment / secrets" below, this contradicts the Slice-0-era
    assumption that a key would be present).
  - **Strands SDK research — materially affects Slice 5's design, see
    `docs/DECISIONS.md`'s "Strands Agents SDK confirmed real..." entry for full detail**:
    `strands-agents` (PyPI, 1.55.1 latest) is genuinely installable and ships a first-class
    `strands.interventions.InterventionHandler` with a literal `before_tool_call` lifecycle
    method returning typed `Proceed`/`Deny`/`Guide`/`Confirm`/`Transform` decisions — this
    is real, verified (installed + source read), not inferred from documentation. `Deny`
    genuinely blocks tool execution and short-circuits remaining handlers.
    `on_error="deny"` should be Slice 5's default (fail-closed) for the permission gate.
    The one unverified piece: an actual live Bedrock model invocation over the network —
    no AWS credentials exist in this dev environment yet, so only construction/credential-
    detection was exercised, not the real API round trip.

### In progress
- [ ] Prisma schema (Company Brain data model) — Slice 1 (separate concurrent agent; check
      its own commits/status rather than assuming done)
- [ ] Seed script + Company Pulse page — Slice 1
- [ ] Connectors, agents, permission gate — Slices 3+ (LLM layer they'll sit on is done)
- [ ] Remaining UI screens (10 listed in SDD §7)

### Next up
**Slice 3** (see `docs/SLICES.md`): Event system + Observer agent. `Event` table writable
via a Next.js internal API endpoint (depends on Slice 1's Prisma schema landing). Seed/cron
script pushes synthetic events. Observer agent (agent-service) reads new events, classifies
significance via `app/llm/get_provider()` (now built), writes results back through Next.js's
API. Inbox/Events UI screen lists events with classification.

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
