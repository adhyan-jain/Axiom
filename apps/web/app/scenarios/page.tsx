import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function ScenariosPage() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Counterfactual Scenario Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Natural-language counterfactual scenario analysis grounded in deterministic financial trajectory math
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {scenarios.length === 0 ? (
          <div className="p-8 text-center border rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500">
            No counterfactual scenarios evaluated yet. Use the command bar to evaluate a scenario.
          </div>
        ) : (
          scenarios.map((s) => {
            const options = Array.isArray(s.options) ? s.options : [];
            return (
              <div
                key={s.id}
                className="p-6 border rounded-xl bg-card text-card-foreground shadow-sm space-y-4"
              >
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Question: &quot;{s.question}&quot;
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {options.map((opt: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-2 text-xs"
                    >
                      <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 block">
                        {opt.label}
                      </span>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Projected Runway:</span>
                        <span className="font-bold">{opt.projected_runway_months} months</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>Runway Delta:</span>
                        <span
                          className={`font-bold ${
                            opt.runway_delta_months < 0 ? "text-red-500" : "text-emerald-500"
                          }`}
                        >
                          {opt.runway_delta_months} months
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border border-indigo-500/20 bg-indigo-500/5 rounded-lg space-y-1">
                  <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 block">
                    LLM Recommendation & Trigger Condition:
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {s.recommendation}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
