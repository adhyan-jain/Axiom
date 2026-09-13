#!/usr/bin/env bash
# Run apps/agent-service locally. Uses `uv` if available, else falls back to a venv + pip.
set -euo pipefail
cd "$(dirname "$0")"

if command -v uv >/dev/null 2>&1; then
  uv sync
  exec uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
else
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -r requirements.txt
  exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
fi
