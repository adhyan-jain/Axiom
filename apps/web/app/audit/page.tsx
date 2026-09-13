import { prisma } from "@/lib/prisma";
import { StructuredPanel } from "@/components/StructuredData";

export const revalidate = 0;

export default async function AuditLogPage() {
  const auditEntries = await prisma.auditLogEntry.findMany({
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Agent Activity & Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete, immutable trail of all agent tool executions and authorization decisions
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {auditEntries.length === 0 ? (
          <div className="p-8 text-center border rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500">
            No audit log entries recorded yet.
          </div>
        ) : (
          auditEntries.map((entry) => (
            <div
              key={entry.id}
              className="p-5 border rounded-xl bg-card text-card-foreground shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-base text-slate-900 dark:text-slate-100">
                    {entry.action}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
                    {entry.agent} agent
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    tool: {entry.tool}
                  </span>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    entry.authorizationDecision.startsWith("allowed")
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  }`}
                >
                  {entry.authorizationDecision}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <StructuredPanel label="Input" data={entry.input} />
                <StructuredPanel label="Output" data={entry.output} />
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t">
                <span>Verification: {entry.verificationStatus}</span>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
