"use client";

import { useState, useTransition } from "react";
import { DecisionStatus } from "@prisma/client";
import { createDecisionAction, updateDecisionAction, type DecisionFormInput } from "@/app/decisions/actions";

type Props = {
  mode: "create" | "edit";
  decisionId?: string;
  initial?: Partial<DecisionFormInput>;
  onDone?: () => void;
};

export default function DecisionForm({ mode, decisionId, initial, onDone }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [evidence, setEvidence] = useState(initial?.evidence ?? "");
  const [consequences, setConsequences] = useState(initial?.consequences ?? "");
  const [relatedEventIds, setRelatedEventIds] = useState(initial?.relatedEventIds ?? "");
  const [reviewDate, setReviewDate] = useState(initial?.reviewDate ?? "");
  const [status, setStatus] = useState<DecisionStatus>(initial?.status ?? DecisionStatus.ACTIVE);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: DecisionFormInput = { title, reason, evidence, consequences, relatedEventIds, reviewDate, status };
    startTransition(async () => {
      const result =
        mode === "create" ? await createDecisionAction(input) : await updateDecisionAction(decisionId!, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "create") {
        setTitle("");
        setReason("");
        setEvidence("");
        setConsequences("");
        setRelatedEventIds("");
        setReviewDate("");
        setStatus(DecisionStatus.ACTIVE);
      }
      onDone?.();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-label={mode === "create" ? "Record a decision" : "Edit decision"}>
      <label className="block space-y-1 text-body-sm">
        <span className="text-ink-secondary">Decision</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          placeholder="e.g. Stay on AWS below ₹75k/mo"
        />
      </label>
      <label className="block space-y-1 text-body-sm">
        <span className="text-ink-secondary">Rationale</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={2}
          className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Evidence (one per line)</span>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={2}
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          />
        </label>
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Related event IDs (comma-separated)</span>
          <textarea
            value={relatedEventIds}
            onChange={(e) => setRelatedEventIds(e.target.value)}
            rows={2}
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          />
        </label>
      </div>
      <label className="block space-y-1 text-body-sm">
        <span className="text-ink-secondary">Consequences</span>
        <textarea
          value={consequences}
          onChange={(e) => setConsequences(e.target.value)}
          rows={2}
          className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          placeholder="What this decision commits the org to"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Review date</span>
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 font-num text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          />
        </label>
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DecisionStatus)}
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          >
            <option value={DecisionStatus.ACTIVE}>Active</option>
            <option value={DecisionStatus.SUPERSEDED}>Superseded</option>
            <option value={DecisionStatus.REVERSED}>Reversed</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-hairline bg-signal-action/20 px-3 py-1.5 text-body-sm font-medium text-signal-action hover:bg-signal-action/30 disabled:opacity-50"
        >
          {isPending ? "Saving…" : mode === "create" ? "Record decision" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button type="button" onClick={() => onDone?.()} className="text-body-sm text-ink-faint hover:text-ink-secondary">
            Cancel
          </button>
        )}
        {error && <span className="text-body-sm text-signal-risk">{error}</span>}
      </div>
    </form>
  );
}
