import { prisma } from "@/lib/prisma";
import { Surface } from "@/components/primitives";
import ScenarioCard from "@/components/ScenarioCard";

export const revalidate = 0;

export default async function ScenariosPage() {
  const [scenarios, org] = await Promise.all([
    prisma.scenario.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.organization.findFirst({
      include: { runwaySnapshots: { orderBy: { computedAt: "desc" }, take: 1 } },
    }),
  ]);

  const currentRunwayMonths = org?.runwaySnapshots[0]?.runwayMonths ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="border-b border-hairline pb-6">
        <h1 className="display-heading text-display-lg text-ink-primary">Strategy simulation</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Today vs. each option&apos;s runway/growth/risk deltas, with a recommendation and its
          trigger condition — grounded in deterministic financial math, narrated by the LLM
        </p>
      </div>

      {scenarios.length === 0 ? (
        <Surface tier={1} className="p-8 text-center text-body-sm text-ink-faint">
          No scenarios evaluated yet. Use the command bar to ask something like &quot;Should I
          hire a developer next month?&quot;
        </Surface>
      ) : (
        <div className="space-y-6">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} currentRunwayMonths={currentRunwayMonths} />
          ))}
        </div>
      )}
    </main>
  );
}
