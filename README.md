# Axiom

An agentic operating system for solo founders / 1-5 person startups — a continuously
updated "Company Brain" that observes changes, understands consequences, and helps plan
and (with permission) act on them.

This repo is in early scaffolding. For the full picture:

- **`docs/SDD.md`** — the locked system design doc (architecture, scope, data model, demo
  scenario). Read this first.
- **`docs/DECISIONS.md`** — append-only log of non-obvious decisions and why they were made.
- **`docs/HANDOFF.md`** — live build status. Read this to see exactly what's done, what's
  in progress, and what to do next.

## Layout

```
apps/
  web/              Next.js 14 (App Router) + TypeScript + Tailwind. Owns all durable
                     state (Postgres via Prisma, from Slice 1).
  agent-service/     Python FastAPI. Multi-agent orchestration (Strands Agents). Stateless
                     — calls back into apps/web's internal API for reads/writes.
packages/
  shared-types/      Shared TypeScript types for entities & events.
```

## Running locally

Prerequisites: Node.js 20+, pnpm, Python 3.11+ (uv recommended), Docker (for Postgres/Redis
once wired in Slice 1+).

```bash
# install JS deps
pnpm install

# copy env vars
cp .env.example .env

# run apps/web (Next.js dev server, http://localhost:3000)
pnpm dev

# run apps/agent-service (FastAPI, http://localhost:8000) — separate terminal
cd apps/agent-service
./run.sh
```

With both running, `http://localhost:3000` should show a health page confirming apps/web
can reach apps/agent-service.

Postgres + Redis are available via `docker compose up -d` but not yet wired into the apps
(that starts in Slice 1).
