import { prisma } from "@/lib/prisma";
import ProcessEventButton from "@/components/ProcessEventButton";
import { StructuredPanel, StructuredNode } from "@/components/StructuredData";

export const revalidate = 0;

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Inbox / Events Stream
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time event stream processed by Observer Agent
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="p-8 text-center border rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500">
            No events logged yet.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="p-5 border rounded-xl bg-card text-card-foreground shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                    {event.entityType} Event
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                    {event.source}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      event.processed
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}
                  >
                    {event.processed ? "Processed by Observer" : "Pending Processing"}
                  </span>
                  {!event.processed && <ProcessEventButton eventId={event.id} />}
                </div>
              </div>

              {event.newState && (
                <StructuredPanel label="Resulting state" data={event.newState} />
              )}

              {Array.isArray(event.evidence) && event.evidence.length > 0 && (
                <div className="text-xs text-slate-500 space-y-1">
                  <span className="font-semibold block">Evidence:</span>
                  <StructuredNode data={event.evidence as any} />
                </div>
              )}

              <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t">
                <span>Confidence: {(event.confidence * 100).toFixed(0)}%</span>
                <span>Logged at: {new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
