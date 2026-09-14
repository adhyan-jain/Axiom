import { prisma } from "@/lib/prisma";
import { Surface } from "@/components/primitives";
import EventCard from "@/components/EventCard";
import EventLogger from "@/components/EventLogger";

export const revalidate = 0;

export default async function EventsPage() {
  const [events, tasks, approvals] = await Promise.all([
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.task.findMany(),
    prisma.approvalRequest.findMany(),
  ]);

  // Tasks/approvals aren't FK-linked to Event in the schema (see docs/DECISIONS.md —
  // Task.source is a freeform string like "event:<id>" or "operator_agent"). Match on that
  // convention to surface the RESPONSE stage without a schema migration.
  const taskBySource = new Map(tasks.map((t) => [t.source, t]));
  const approvalByEventId = new Map<string, (typeof approvals)[number]>();
  for (const approval of approvals) {
    const inv = approval.toolInvocation as Record<string, unknown> | null;
    const eventId = inv && typeof inv === "object" ? (inv["eventId"] as string | undefined) : undefined;
    if (eventId) approvalByEventId.set(eventId, approval);
  }

  const unprocessedCount = events.filter((e) => !e.processed).length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display-heading text-display-lg text-ink-primary">Signal stream</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">
            Every observed change, what Axiom thinks it means, what it caused, and what happened next
          </p>
        </div>
        <span className="text-body-sm font-num text-ink-secondary">
          {unprocessedCount} awaiting interpretation
        </span>
      </div>

      <Surface tier={1} className="p-5">
        <h2 className="mb-3 display-heading text-display-sm text-ink-primary">Log an event</h2>
        <EventLogger />
      </Surface>

      <div className="space-y-4">
        {events.length === 0 ? (
          <Surface tier={1} className="p-8 text-center text-body-sm text-ink-faint">
            No events logged yet.
          </Surface>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={{ ...event, evidence: event.evidence, newState: event.newState }}
              relatedTask={
                taskBySource.get(`event:${event.id}`)
                  ? {
                      title: taskBySource.get(`event:${event.id}`)!.title,
                      why: taskBySource.get(`event:${event.id}`)!.why,
                      status: taskBySource.get(`event:${event.id}`)!.status,
                    }
                  : null
              }
              relatedApproval={
                approvalByEventId.get(event.id)
                  ? {
                      reason: approvalByEventId.get(event.id)!.reason,
                      status: approvalByEventId.get(event.id)!.status,
                    }
                  : null
              }
            />
          ))
        )}
      </div>
    </main>
  );
}
