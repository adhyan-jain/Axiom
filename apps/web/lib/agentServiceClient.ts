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

/**
 * Thrown by every typed call below when agent-service is unreachable, returns a
 * non-2xx status (including 503 from an unconfigured LLM provider — see
 * app/llm/base.py's ProviderNotConfiguredError), or returns a body that fails to parse
 * as JSON. Callers (API routes) should catch this and surface a clear 502/503 to their
 * own caller rather than letting an unhandled exception 500 out.
 */
export class AgentServiceError extends Error {
  readonly status: number | null;
  readonly path: string;

  constructor(message: string, opts: { status: number | null; path: string }) {
    super(message);
    this.name = "AgentServiceError";
    this.status = opts.status;
    this.path = opts.path;
  }
}

/** POSTs JSON to agent-service and returns the parsed JSON response, typed as T. */
async function postAgentService<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await agentServiceFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AgentServiceError(
      `agent-service unreachable at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      { status: null, path },
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = typeof errBody?.detail === "string" ? errBody.detail : JSON.stringify(errBody);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new AgentServiceError(
      `agent-service ${path} responded with HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
      { status: res.status, path },
    );
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new AgentServiceError(
      `agent-service ${path} returned a non-JSON response: ${err instanceof Error ? err.message : String(err)}`,
      { status: res.status, path },
    );
  }
}

// ───────────────────────────── Typed endpoint methods ─────────────────────────────
// Mirrors apps/agent-service/app/main.py's route bodies/response shapes. Kept as loosely
// typed `Record<string, unknown>` / `any` payloads rather than re-declaring every Pydantic
// model in TS, since agent-service is the source of truth for these shapes and this client
// is a thin transport layer, not a schema duplication point.

export type EventClassification = {
  significance: string;
  summary: string;
  recommended_actions: string[];
  flagged_anomalies: string[];
};

export async function observerProcess(event: Record<string, unknown>): Promise<EventClassification> {
  return postAgentService<EventClassification>("/observer/process", { event });
}

export type StateProcessResult = {
  new_state: Record<string, unknown>;
  narrative: { summary: string; bottleneck: string };
};

export async function stateProcess(
  currentState: Record<string, unknown>,
  event: Record<string, unknown>,
): Promise<StateProcessResult> {
  return postAgentService<StateProcessResult>("/state/process", {
    current_state: currentState,
    event,
  });
}

export type BottleneckAnalysis = {
  primary_bottleneck: string;
  why: string;
  recommended_focus: string;
};

export async function strategistAnalyze(
  goalData: Record<string, unknown>,
  financialState: Record<string, unknown>,
): Promise<BottleneckAnalysis> {
  return postAgentService<BottleneckAnalysis>("/strategist/analyze", {
    goal_data: goalData,
    financial_state: financialState,
  });
}

export type GateCheckResult = {
  allowed: boolean;
  permission_level: string;
  action_type: string;
  reason: string | null;
  requires_approval: boolean;
};

export type OperatorProposal = {
  task: {
    title: string;
    why: string;
    impact: string;
    action_type: string;
    priority: string;
    tool_invocation: Record<string, unknown>;
  };
  gate_result: GateCheckResult;
};

export async function operatorPropose(
  bottleneck: Record<string, unknown>,
  policyTable: Record<string, string>,
): Promise<OperatorProposal[]> {
  return postAgentService<OperatorProposal[]>("/operator/propose", {
    bottleneck,
    policy_table: policyTable,
  });
}

export type VerificationResult = {
  verified: boolean;
  status: string;
  details: string;
};

export async function verifierVerify(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): Promise<VerificationResult> {
  return postAgentService<VerificationResult>("/verifier/verify", { expected, actual });
}

export type DecisionConflictResult = {
  has_conflict: boolean;
  conflicting_decision_title: string | null;
  explanation: string | null;
};

export async function memoryCheckConflict(
  event: Record<string, unknown>,
  activeDecisions: Record<string, unknown>[],
): Promise<DecisionConflictResult> {
  return postAgentService<DecisionConflictResult>("/memory/check-conflict", {
    event,
    active_decisions: activeDecisions,
  });
}

export async function connectorSync(
  provider: string,
  mode: "SEEDED" | "LIVE" = "SEEDED",
): Promise<Record<string, unknown>[]> {
  return postAgentService<Record<string, unknown>[]>("/connectors/sync", { provider, mode });
}

export type ScenarioOption = {
  label: string;
  monthly_burn_delta: number;
  projected_burn: number;
  projected_runway_months: number;
  runway_delta_months: number;
};

export type ScenarioResult = {
  question: string;
  options: ScenarioOption[];
  recommendation: string;
  trigger_condition: string;
};

export async function scenarioEvaluate(
  question: string,
  cashOnHand: number,
  monthlyBurn: number,
): Promise<ScenarioResult> {
  return postAgentService<ScenarioResult>("/scenario/evaluate", {
    question,
    cash_on_hand: cashOnHand,
    monthly_burn: monthlyBurn,
  });
}
