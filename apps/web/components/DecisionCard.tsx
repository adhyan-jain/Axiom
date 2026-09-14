"use client";

import { useState, useTransition } from "react";
import { archiveDecisionAction } from "@/app/decisions/actions";
import DecisionForm from "@/components/DecisionForm";
import { Surface, CausalChain } from "@/components/primitives";
import type { CausalLink } from "@/components/primitives";

type DecisionLike = {
  id: string;
  title: string;
  reason: string;
  evidence: unknown;
  consequences: string | null;
  relatedEventIds: unknown;
  date: string | Date;
  reviewDate: string | Date | null;
  status: "ACTIVE" | "SUPERSEDED" | "REVERSED";
};

const STATUS_TONE: Record<DecisionLike["status"], string> = {
  ACTIVE: "text-trajectory-positive border-trajectory-positive/40",
  SUPERSEDED: "text-signal-uncertainty border-signal-uncertainty/40",
  REVERSED: "text-signal-risk border-signal-risk/40",
};

/**
 * DecisionCard — organizational memory: decision + rationale + evidence + consequences
 * + status + conflicts + review date + related events. A conflicting new signal is
 * rendered as a CausalChain (old decision -> new signal -> conflict -> recommendation)
 * per the redesign brief, rather than a plain red alert box.
 */
export default function DecisionCard({
  decision,
  conflicts,
}: {
  decision: DecisionLike;
  conflicts: { title: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);

  const evidenceList = Array.isArray(decision.evidence) ? (decision.evidence as unknown[]) : [];
  const relatedEvents = Array.isArray(decision.relatedEventIds) ? (decision.relatedEventIds as unknown[]) : [];

  const handleArchive = () => {
    setError(null);
    startTransition(async () => {
      const result = await archiveDecisionAction(decision.id);
      if (!result.ok) setError(result.error);
      else setArchived(true);
    });
  };

  if (editing) {
    return (
      <Surface tier={1} className="p-5">
        <DecisionForm
          mode="edit"
          decisionId={decision.id}
          initial={{
            title: decision.title,
            reason: decision.reason,
            evidence: evidenceList.join("\n"),
            consequences: decision.consequences ?? "",
            relatedEventIds: relatedEvents.join(", "),
            reviewDate: decision.reviewDate ? new Date(decision.reviewDate).toISOString().slice(0, 10) : "",
            status: decision.status,
          }}
          onDone={() => setEditing(false)}
        />
      </Surface>
    );
  }

  const conflictLinks: CausalLink[] = conflicts.length
    ? [
        { kind: "Prior decision", title: decision.title, tone: "neutral" },
        { kind: "New signal", title: "A newer decision conflicts with this one", tone: "warning" },
        {
          kind: "Conflict",
          title: conflicts.map((c) => c.title).join(", "),
          tone: "risk",
        },
        { kind: "Recommendation", title: "Review and reconcile before next cycle", tone: "action" },
      ]
    : [];

  return (
    <Surface tier={1} className={`space-y-3 p-5 ${archived ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-body-lg font-medium text-ink-primary">{decision.title}</h3>
        <span className={`rounded-sm border px-2 py-0.5 text-body-sm font-num ${STATUS_TONE[decision.status]}`}>
          {decision.status}
        </span>
      </div>

      <p className="text-body-sm text-ink-secondary">
        <span className="text-micro uppercase text-ink-faint">Rationale </span>
        {decision.reason}
      </p>

      {decision.consequences && (
        <p className="text-body-sm text-ink-secondary">
          <span className="text-micro uppercase text-ink-faint">Consequences </span>
          {decision.consequences}
        </p>
      )}

      {evidenceList.length > 0 && (
        <div className="text-body-sm text-ink-faint">
          <span className="text-micro uppercase text-ink-faint">Evidence </span>
          {evidenceList.map((item, i) => (
            <span key={i} className="mr-2 rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 font-num text-ink-secondary">
              {String(item)}
            </span>
          ))}
        </div>
      )}

      {relatedEvents.length > 0 && (
        <div className="text-body-sm text-ink-faint">
          <span className="text-micro uppercase text-ink-faint">Related events </span>
          {relatedEvents.map((item, i) => (
            <span key={i} className="mr-2 rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 font-num text-ink-secondary">
              {String(item)}
            </span>
          ))}
        </div>
      )}

      {conflictLinks.length > 0 && <CausalChain links={conflictLinks} />}

      <div className="flex items-center justify-between border-t border-hairline pt-3 text-body-sm text-ink-faint">
        <span>Decided {new Date(decision.date).toLocaleDateString()}</span>
        {decision.reviewDate && <span>Review by {new Date(decision.reviewDate).toLocaleDateString()}</span>}
      </div>

      {error && <p className="text-body-sm text-signal-risk">{error}</p>}

      {!archived && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-hairline px-2.5 py-1 text-body-sm text-ink-secondary hover:bg-surface-2"
          >
            Edit
          </button>
          {decision.status === "ACTIVE" && (
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="rounded border border-hairline px-2.5 py-1 text-body-sm text-signal-uncertainty hover:bg-surface-2 disabled:opacity-50"
            >
              {isPending ? "Archiving…" : "Archive"}
            </button>
          )}
        </div>
      )}
    </Surface>
  );
}
