import { prisma } from "@/lib/prisma";
import { Surface } from "@/components/primitives";
import DecisionCard from "@/components/DecisionCard";
import DecisionLogger from "@/components/DecisionLogger";

export const revalidate = 0;

export default async function MemoryDecisionsPage() {
  const decisions = await prisma.decision.findMany({
    orderBy: { date: "desc" },
    include: {
      conflictsFrom: { include: { conflictsWith: true } },
    },
  });

  const active = decisions.filter((d) => d.status === "ACTIVE");
  const archived = decisions.filter((d) => d.status !== "ACTIVE");

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="border-b border-hairline pb-6">
        <h1 className="display-heading text-display-lg text-ink-primary">Organizational memory</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Decisions, why they were made, what they cost, and what conflicts with them now
        </p>
      </div>

      <Surface tier={1} className="p-5">
        <h2 className="mb-3 display-heading text-display-sm text-ink-primary">Record a decision</h2>
        <DecisionLogger />
      </Surface>

      <section className="space-y-4">
        <h2 className="display-heading text-display-sm text-ink-primary">Active ({active.length})</h2>
        {active.length === 0 ? (
          <Surface tier={1} className="p-8 text-center text-body-sm text-ink-faint">
            No active decisions on record yet.
          </Surface>
        ) : (
          <div className="space-y-4">
            {active.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                conflicts={decision.conflictsFrom.map((c) => ({ title: c.conflictsWith.title }))}
              />
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="space-y-4">
          <h2 className="display-heading text-display-sm text-ink-primary">
            Superseded / reversed ({archived.length})
          </h2>
          <div className="space-y-4">
            {archived.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                conflicts={decision.conflictsFrom.map((c) => ({ title: c.conflictsWith.title }))}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
