import { prisma } from "@/lib/prisma";
import { Surface } from "@/components/primitives";
import AuditEntryRow from "@/components/AuditEntryRow";

export const revalidate = 0;

export default async function AuditLogPage() {
  const auditEntries = await prisma.auditLogEntry.findMany({
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  const agents = Array.from(new Set(auditEntries.map((e) => e.agent))).sort();

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="flex flex-col gap-3 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display-heading text-display-lg text-ink-primary">Audit timeline</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">
            Every agent tool call, evidence, permission decision, and verification outcome —
            immutable, forensic order
          </p>
        </div>
        {agents.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agents.map((agent) => (
              <span
                key={agent}
                className="rounded-sm border border-hairline bg-surface-2 px-2 py-0.5 text-body-sm font-num text-ink-secondary"
              >
                {agent}
              </span>
            ))}
          </div>
        )}
      </div>

      {auditEntries.length === 0 ? (
        <Surface tier={1} className="p-8 text-center text-body-sm text-ink-faint">
          No audit log entries recorded yet.
        </Surface>
      ) : (
        <ol className="space-y-0">
          {auditEntries.map((entry, i) => (
            <AuditEntryRow key={entry.id} entry={entry} isLast={i === auditEntries.length - 1} />
          ))}
        </ol>
      )}
    </main>
  );
}
