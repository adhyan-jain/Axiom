import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function MemoryDecisionsPage() {
  const decisions = await prisma.decision.findMany({
    orderBy: { date: "desc" },
    include: {
      conflictsFrom: { include: { conflictsWith: true } },
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Organizational Memory & Decisions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Active strategic decisions, rationale history, and surfaced policy conflict flags
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {decisions.length === 0 ? (
          <div className="p-8 text-center border rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500">
            No active decisions logged in memory.
          </div>
        ) : (
          decisions.map((decision) => (
            <div
              key={decision.id}
              className="p-5 border rounded-xl bg-card text-card-foreground shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  {decision.title}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">
                  {decision.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                <span className="font-semibold text-xs text-slate-400 block mb-1">Rationale:</span>
                {decision.reason}
              </p>
              {decision.conflictsFrom.length > 0 && (
                <div className="p-3 border border-red-500/30 bg-red-500/10 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-red-600 dark:text-red-400 block">
                    Flagged Conflict:
                  </span>
                  {decision.conflictsFrom.map((c) => (
                    <div key={c.id} className="text-red-700 dark:text-red-300">
                      Conflicts with decision: &quot;{c.conflictsWith.title}&quot;
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t">
                <span>Logged Date: {new Date(decision.date).toLocaleDateString()}</span>
                {decision.reviewDate && (
                  <span>Review Date: {new Date(decision.reviewDate).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
