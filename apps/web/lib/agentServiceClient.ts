/**
 * Thin server-side client for calling apps/agent-service from apps/web.
 *
 * Every internal request carries the `X-Axiom-Internal-Secret` header (see
 * apps/agent-service/app/auth.py for the matching FastAPI dependency that validates it).
 * This convention is load-bearing for every later slice's web<->agent-service calls —
 * route new calls through `agentServiceFetch` rather than calling `fetch` directly.
 *
 * Server-only: reads AGENT_SERVICE_SHARED_SECRET, which must never reach the client.
 */
import "server-only";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";
const AGENT_SERVICE_SHARED_SECRET = process.env.AGENT_SERVICE_SHARED_SECRET ?? "";
export const INTERNAL_SECRET_HEADER = "X-Axiom-Internal-Secret";

export async function agentServiceFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(path, AGENT_SERVICE_URL);
  const headers = new Headers(init.headers);
  headers.set(INTERNAL_SECRET_HEADER, AGENT_SERVICE_SHARED_SECRET);

  return fetch(url, {
    ...init,
    headers,
    // Slice 0: always fetch fresh; caching strategy revisited once real data exists.
    cache: "no-store",
  });
}

export type AgentServiceHealth = { status: string };

/** Result of checking apps/agent-service's /health endpoint. Never throws. */
export type HealthCheckResult =
  | { ok: true; status: string }
  | { ok: false; error: string };

export async function checkAgentServiceHealth(): Promise<HealthCheckResult> {
  try {
    const res = await agentServiceFetch("/health");
    if (!res.ok) {
      return { ok: false, error: `agent-service responded with HTTP ${res.status}` };
    }
    const data = (await res.json()) as AgentServiceHealth;
    return { ok: true, status: data.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error reaching agent-service",
    };
  }
}
