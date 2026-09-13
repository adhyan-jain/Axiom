"use client";

import { useState, useTransition } from "react";
import { deleteEventAction, type EventFormInput } from "@/app/events/actions";
import ProcessEventButton from "@/components/ProcessEventButton";
import EventForm from "@/components/EventForm";
import { Surface, CausalChain, AuthorityBadge } from "@/components/primitives";
import type { CausalLink } from "@/components/primitives";

type EventLike = {
  id: string;
  source: string;
  entityType: string;
  entityId: string | null;
  confidence: number;
  evidence: unknown;
  processed: boolean;
  createdAt: string | Date;
  newState: unknown;
};

type RelatedTask = { title: string; why: string; status: string } | null;
type RelatedApproval = { reason: string | null; status: string } | null;

/**
 * EventCard — one row in the Events signal stream, decomposed as
 * SIGNAL → INTERPRETATION → CONSEQUENCE → RESPONSE → VERIFICATION rather than a flat
 * list item, per the redesign brief. CausalChain (shared with Home) renders the
 * interpretation/consequence/response/verification links as one connected sequence;
 * SIGNAL itself is the card header since it's the anchor everything else refers to.
 */
export default function EventCard({
  event,
  relatedTask,
  relatedApproval,
}: {
  event: EventLike;
  relatedTask: RelatedTask;
  relatedApproval: RelatedApproval;
}) {
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const classification =
    typeof event.newState === "object" && event.newState !== null
      ? (event.newState as Record<string, unknown>)._observerClassification
      : undefined;
  const classificationSummary =
    classification && typeof classification === "object"
      ? ((classification as Record<string, unknown>).summary as string | undefined)
      : undefined;
  const classificationSignificance =
    classification && typeof classification === "object"
      ? ((classification as Record<string, unknown>).significance as string | undefined)
      : undefined;
  const note =
    typeof event.newState === "object" && event.newState !== null
      ? ((event.newState as Record<string, unknown>).note as string | undefined)
      : undefined;

  const links: CausalLink[] = [
    {
      kind: "Interpretation",
      title: event.processed
        ? classificationSummary ?? "Classified by Observer"
        : "Not yet interpreted",
      detail: classificationSignificance ?? (event.processed ? undefined : "Awaiting Observer classification"),
      tone: event.processed ? "neutral" : "warning",
    },
  ];
  if (note) {
    links.push({ kind: "Consequence", title: note, tone: "neutral" });
  }
  if (relatedTask) {
    links.push({
      kind: "Response",
      title: relatedTask.title,
      detail: `${relatedTask.why} (${relatedTask.status})`,
      tone: "action",
    });
  }
  if (relatedApproval) {
    links.push({
      kind: "Response",
      title: "Awaiting founder authority",
      detail: relatedApproval.reason ?? undefined,
      tone: "warning",
    });
  }
  links.push({
    kind: "Verification",
    title: event.processed ? "Observer classification recorded" : "Not verifiable yet",
    tone: event.processed ? "positive" : "neutral",
  });

  const evidenceList = Array.isArray(event.evidence) ? (event.evidence as unknown[]) : [];

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      if (!result.ok) {
        setError(result.error);
      } else {
        setDeleted(true);
      }
    });
  };

  if (deleted) return null;

  if (editing) {
    return (
      <Surface tier={1} className="p-5">
        <EventForm
          mode="edit"
          eventId={event.id}
          initial={{
            source: event.source,
            entityType: event.entityType,
            entityId: event.entityId ?? "",
            confidence: event.confidence,
            evidence: evidenceList.join("\n"),
            newState: note ?? "",
          }}
          onDone={() => setEditing(false)}
        />
      </Surface>
    );
  }

  return (
    <Surface tier={1} className="p-5 space-y-4 animate-trace-in">
      {/* SIGNAL */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-micro uppercase text-ink-faint">Signal</span>
            <span className="rounded-sm border border-hairline bg-surface-2 px-1.5 py-0.5 text-body-sm font-num text-ink-secondary">
              {event.source}
            </span>
          </div>
          <h3 className="mt-1 text-body-lg font-medium text-ink-primary">
            {event.entityType} {event.entityId ? `· ${event.entityId}` : ""}
          </h3>
          <p className="text-body-sm text-ink-faint">
            {new Date(event.createdAt).toLocaleString()} · confidence {(event.confidence * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AuthorityBadge state={event.processed ? "verified" : "observed"} />
          {!event.processed && <ProcessEventButton eventId={event.id} />}
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-hairline px-2.5 py-1 text-body-sm text-ink-secondary hover:bg-surface-2"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded border border-hairline px-2.5 py-1 text-body-sm text-signal-risk hover:bg-surface-2 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {error && <p className="text-body-sm text-signal-risk">{error}</p>}

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

      {/* INTERPRETATION → CONSEQUENCE → RESPONSE → VERIFICATION */}
      <CausalChain links={links} />
    </Surface>
  );
}
