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

**Phase: Slice 0 complete.** Monorepo scaffold built and verified end-to-end (see below).

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

### In progress
- [ ] Prisma schema (Company Brain data model) — Slice 1
- [ ] Seed script + Company Pulse page — Slice 1
- [ ] Agent-service: LLM provider abstraction, connectors, agents, permission gate —
      Slices 2+
- [ ] Remaining UI screens (10 listed in SDD §7)

### Next up
**Slice 1** (see `docs/SLICES.md` for full description): Prisma schema in `apps/web`
covering the core Company Brain entities from SDD §4, wire `DATABASE_URL` to the
docker-compose Postgres, a seed script for the demo org (founder, customers, ₹10L ARR goal,
₹2.4L ARR/cash/burn current state), and turn the Slice 0 health page into a real "Company
Pulse" page reading seeded state.

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

- `ANTHROPIC_API_KEY` — assumed available in this dev environment for the `anthropic`
  LLM provider path.
- AWS credentials — **not yet provided**. `bedrock_strands` provider is fully implemented
  but inert until `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or a profile) + `AWS_REGION`
  are set. No code changes should be needed when the user adds them — verify this stays
  true as the provider is built.
- No OAuth client IDs/secrets configured for Gmail/Slack/Calendar/Drive/GitHub — live
  connectors are stubs by design.
