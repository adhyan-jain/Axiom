import { Surface, AuthorityBadge } from "@/components/primitives";
import type { AuthorityState } from "@/components/primitives";
import { StructuredPanel } from "@/components/StructuredData";

type AuditEntryLike = {
  id: string;
  timestamp: string | Date;
  agent: string;
  action: string;
  tool: string;
  input: unknown;
  output: unknown;
  evidence: unknown;
  authorizationDecision: string;
  result: string;
  verificationStatus: string;
};

function authorityFromDecision(decision: string): AuthorityState {
  if (decision.startsWith("allowed")) return decision.includes("override") ? "authorized" : "executed";
  if (decision.startsWith("blocked")) return "awaiting_approval";
  return "inferred";
}

function authorityFromVerification(status: string): AuthorityState {
  if (status === "verified") return "verified";
  if (status === "failed") return "failed";
  return "drafted"; // "unverified" — reviewed but not yet independently confirmed
}

/**
 * AuditEntryRow — one node on the forensic timeline. Evidence is a first-class visual
 * element (chip row, not buried inside a JSON blob); permission level and outcome are
 * distinguishable AuthorityBadges rather than a single ambiguous pill.
 */
export default function AuditEntryRow({ entry, isLast }: { entry: AuditEntryLike; isLast: boolean }) {
  const evidenceList = Array.isArray(entry.evidence) ? (entry.evidence as unknown[]) : [];
  const permissionLevel = entry.authorizationDecision.split(":")[1] ?? entry.authorizationDecision;

  return (
    <li className="relative flex gap-4">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            entry.result === "success" ? "bg-trajectory-positive" : entry.result === "blocked" ? "bg-signal-warning" : "bg-signal-risk"
          }`}
          aria-hidden="true"
        />
        {!isLast && <span className="w-px flex-1 bg-hairline" aria-hidden="true" />}
      </div>

      <Surface tier={1} className="mb-6 flex-1 space-y-3 p-5 animate-trace-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 text-body-sm font-num text-ink-secondary">
                {entry.agent}
              </span>
              <span className="text-body-sm font-num text-ink-faint">{entry.tool}</span>
            </div>
            <h3 className="mt-1 text-body-lg font-medium text-ink-primary">{entry.action}</h3>
          </div>
          <span className="whitespace-nowrap text-body-sm text-ink-faint">
            {new Date(entry.timestamp).toLocaleString()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AuthorityBadge state={authorityFromDecision(entry.authorizationDecision)} />
          <span className="rounded-sm border border-hairline bg-surface-2 px-2 py-0.5 text-body-sm text-ink-secondary">
            permission: {permissionLevel}
          </span>
          <AuthorityBadge state={authorityFromVerification(entry.verificationStatus)} />
        </div>

        {evidenceList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-micro uppercase text-ink-faint">Evidence</span>
            {evidenceList.map((item, i) => (
              <span
                key={i}
                className="rounded-sm border border-signal-verified/40 bg-signal-verified/10 px-1.5 py-0.5 text-body-sm font-num text-signal-verified"
              >
                {typeof item === "string" ? item : JSON.stringify(item)}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <StructuredPanel label="Input" data={entry.input} />
          <StructuredPanel label="Output" data={entry.output} />
        </div>
      </Surface>
    </li>
  );
}
