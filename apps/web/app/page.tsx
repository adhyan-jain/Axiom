import { prisma } from "@/lib/prisma";
import { checkAgentServiceHealth } from "@/lib/agentServiceClient";
import DemoControls from "@/components/DemoControls";

export const revalidate = 0;

export default async function HomePage() {
  const [health, org] = await Promise.all([
    checkAgentServiceHealth(),
    prisma.organization.findFirst({
      include: {
        goals: { where: { status: "ACTIVE" } },
        runwaySnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
        burnSnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
        tasks: { where: { status: "OPEN" }, take: 5 },
        decisions: { where: { status: "ACTIVE" }, take: 3 },
      },
    }),
  ]);

  const activeGoal = org?.goals[0];
  const latestRunway = org?.runwaySnapshots[0];
  const latestBurn = org?.burnSnapshots[0];

  const formatINR = (paise: number) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(rupees);
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {org?.name || "Company Pulse"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Axiom Company-OS — Live Dashboard & Agent Status
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1 font-mono text-xs flex items-center gap-2 ${
            health.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${health.ok ? "bg-emerald-500" : "bg-red-500"}`} />
          {health.ok ? `agent-service: ${health.status}` : `agent-service: ${health.error}`}
        </div>
      </div>

      {/* Flagship Demo Controls */}
      <DemoControls />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Goal Metric */}
        <div className="rounded-xl border p-6 bg-card text-card-foreground shadow-sm space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {activeGoal?.title || "Primary Goal"}
          </div>
          <div className="text-3xl font-bold">
            {activeGoal ? formatINR(activeGoal.currentValue) : "₹0"}
          </div>
          <div className="text-xs text-slate-500">
            Target: {activeGoal ? formatINR(activeGoal.targetValue) : "₹0"}
          </div>
          {activeGoal && (
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (activeGoal.currentValue / activeGoal.targetValue) * 100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Runway Metric */}
        <div className="rounded-xl border p-6 bg-card text-card-foreground shadow-sm space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Runway
          </div>
          <div className="text-3xl font-bold">
            {latestRunway ? `${latestRunway.runwayMonths} months` : "N/A"}
          </div>
          <div className="text-xs text-slate-500">
            Cash on hand: {latestRunway ? formatINR(latestRunway.cashOnHand) : "₹0"}
          </div>
        </div>

        {/* Monthly Burn Metric */}
        <div className="rounded-xl border p-6 bg-card text-card-foreground shadow-sm space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Monthly Burn
          </div>
          <div className="text-3xl font-bold">
            {latestBurn ? formatINR(latestBurn.monthlyBurn) : "₹0"}
          </div>
          <div className="text-xs text-slate-500">
            Trailing 30-day run rate
          </div>
        </div>
      </div>

      {/* Operational Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Open Tasks */}
        <div className="rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Open Proactive Tasks ({org?.tasks.length || 0})
          </h2>
          <div className="space-y-3">
            {org?.tasks.map((task) => (
              <div key={task.id} className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                    {task.title}
                  </span>
                  <span className="text-xs font-mono uppercase bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded border border-amber-500/20">
                    {task.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{task.why}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Memory / Decisions */}
        <div className="rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Active Memory & Decisions
          </h2>
          <div className="space-y-3">
            {org?.decisions.map((decision) => (
              <div key={decision.id} className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-1">
                <span className="font-medium text-sm text-slate-800 dark:text-slate-200 block">
                  {decision.title}
                </span>
                <p className="text-xs text-slate-500">{decision.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
