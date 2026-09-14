export type AgentActivity = "idle" | "investigating" | "thinking" | "executing" | "verifying";

const ACTIVITY_LABEL: Record<AgentActivity, string> = {
  idle: "Idle",
  investigating: "Investigating",
  thinking: "Reasoning",
  executing: "Executing",
  verifying: "Verifying",
};

/**
 * AgentState — shows what an agent is doing right now. Motion (pulse) is
 * reserved for non-idle states, so it stays meaningful rather than
 * decorative.
 */
export function AgentState({ agent, activity }: { agent: string; activity: AgentActivity }) {
  const active = activity !== "idle";
  return (
    <div className="flex items-center gap-2 text-body-sm">
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-signal-action animate-agent-pulse" : "bg-ink-faint"}`}
        aria-hidden="true"
      />
      <span className="text-ink-secondary">{agent}</span>
      <span className="h-3 w-px bg-hairline" aria-hidden="true" />
      <span className={active ? "text-signal-action" : "text-ink-faint"}>
        {ACTIVITY_LABEL[activity]}
      </span>
    </div>
  );
}
