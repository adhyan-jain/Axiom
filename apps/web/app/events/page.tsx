import { prisma } from "@/lib/prisma";

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
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    event.processed
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {event.processed ? "Processed by Observer" : "Pending Processing"}
                </span>
              </div>

              {event.newState && (
                <div className="text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                  <span className="text-xs text-slate-400 block mb-1">New State Payload:</span>
                  {JSON.stringify(event.newState, null, 2)}
                </div>
              )}

              {Array.isArray(event.evidence) && event.evidence.length > 0 && (
                <div className="text-xs text-slate-500 space-y-1">
                  <span className="font-semibold block">Evidence:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {event.evidence.map((item: any, idx: number) => (
                      <li key={idx}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                    ))}
                  </ul>
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
