export type AuthorityState =
  | "observed"
  | "inferred"
  | "recommended"
  | "drafted"
  | "authorized"
  | "awaiting_approval"
  | "executed"
  | "verified"
  | "rejected"
  | "failed";

const STATE_META: Record<AuthorityState, { label: string; color: string; dot: string }> = {
  observed: { label: "Observed", color: "text-ink-secondary", dot: "bg-ink-secondary" },
  inferred: { label: "Inferred", color: "text-signal-inferred", dot: "bg-signal-inferred" },
  recommended: { label: "Recommended", color: "text-signal-action", dot: "bg-signal-action" },
  drafted: { label: "Drafted", color: "text-signal-uncertainty", dot: "bg-signal-uncertainty" },
  authorized: { label: "Authorized", color: "text-trajectory-positive", dot: "bg-trajectory-positive" },
  awaiting_approval: { label: "Awaiting approval", color: "text-signal-approval", dot: "bg-signal-approval" },
  executed: { label: "Executed", color: "text-signal-action", dot: "bg-signal-action" },
  verified: { label: "Verified", color: "text-signal-verified", dot: "bg-signal-verified" },
  rejected: { label: "Rejected", color: "text-signal-risk", dot: "bg-signal-risk" },
  failed: { label: "Failed", color: "text-signal-risk", dot: "bg-signal-risk" },
};

/**
 * AuthorityBadge — communicates where an action sits on the
 * observed → executed → verified authority spectrum. Never color-only:
 * dot + word label + (for the pending states) a subtle pulse.
 */
export function AuthorityBadge({ state }: { state: AuthorityState }) {
  const meta = STATE_META[state];
  const pending = state === "awaiting_approval" || state === "drafted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-surface-2 px-2 py-0.5 text-body-sm ${meta.color}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${pending ? "animate-agent-pulse" : ""}`}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}
