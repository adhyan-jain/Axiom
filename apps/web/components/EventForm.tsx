"use client";

import { useState, useTransition } from "react";
import { createEventAction, updateEventAction, type EventFormInput } from "@/app/events/actions";

type Props = {
  mode: "create" | "edit";
  eventId?: string;
  initial?: Partial<EventFormInput>;
  onDone?: () => void;
};

/**
 * Create/edit form for a manually-logged Event. Shares one component between the
 * "Log event" flow (top of the Events page) and inline editing of an existing event —
 * same fields, different Server Action underneath.
 */
export default function EventForm({ mode, eventId, initial, onDone }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState(initial?.source ?? "manual");
  const [entityType, setEntityType] = useState(initial?.entityType ?? "");
  const [entityId, setEntityId] = useState(initial?.entityId ?? "");
  const [confidence, setConfidence] = useState(initial?.confidence ?? 1);
  const [evidence, setEvidence] = useState(initial?.evidence ?? "");
  const [note, setNote] = useState(initial?.newState ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: EventFormInput = { source, entityType, entityId, confidence, evidence, newState: note };
    startTransition(async () => {
      const result =
        mode === "create" ? await createEventAction(input) : await updateEventAction(eventId!, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "create") {
        setEntityType("");
        setEntityId("");
        setEvidence("");
        setNote("");
        setConfidence(1);
      }
      onDone?.();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-label={mode === "create" ? "Log a new event" : "Edit event"}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Source</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
            placeholder="e.g. manual, gmail, slack"
          />
        </label>
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Entity type</span>
          <input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            required
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
            placeholder="e.g. Contract, Expense"
          />
        </label>
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Entity ID (optional)</span>
          <input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          />
        </label>
        <label className="space-y-1 text-body-sm">
          <span className="text-ink-secondary">Confidence (0–1)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 font-num text-body text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          />
        </label>
      </div>
      <label className="block space-y-1 text-body-sm">
        <span className="text-ink-secondary">Evidence (one per line)</span>
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          rows={2}
          className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          placeholder="e.g. gmail thread id, invoice link"
        />
      </label>
      <label className="block space-y-1 text-body-sm">
        <span className="text-ink-secondary">Note / observed state</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded border border-hairline bg-surface-3 px-2 py-1.5 text-body-sm text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal-action"
          placeholder="What changed?"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-hairline bg-signal-action/20 px-3 py-1.5 text-body-sm font-medium text-signal-action hover:bg-signal-action/30 disabled:opacity-50"
        >
          {isPending ? "Saving…" : mode === "create" ? "Log event" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => onDone?.()}
            className="text-body-sm text-ink-faint hover:text-ink-secondary"
          >
            Cancel
          </button>
        )}
        {error && <span className="text-body-sm text-signal-risk">{error}</span>}
      </div>
    </form>
  );
}
