import { prisma } from "@/lib/prisma";
import { checkAgentServiceHealth } from "@/lib/agentServiceClient";
import DemoControls from "@/components/DemoControls";
import { Surface, Metric, TrajectoryLine, CausalChain, AgentState, AuthorityBadge } from "@/components/primitives";
import type { CausalLink } from "@/components/primitives";

export const revalidate = 0;

function formatINR(paise: number) {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export default async function HomePage() {
  const [health, org] = await Promise.all([
    checkAgentServiceHealth(),
    prisma.organization.findFirst({
      include: {
        goals: { where: { status: "ACTIVE" }, take: 1 },
        runwaySnapshots: { orderBy: { computedAt: "desc" }, take: 2 },
        burnSnapshots: { orderBy: { computedAt: "desc" }, take: 2 },
        tasks: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 5 },
        decisions: { where: { status: "ACTIVE" }, orderBy: { date: "desc" }, take: 3 },
        events: { orderBy: { createdAt: "desc" }, take: 6 },
        approvalRequests: { where: { status: "PENDING" }, take: 5 },
      },
    }),
  ]);

  const activeGoal = org?.goals[0];
  const [latestRunway, priorRunway] = org?.runwaySnapshots ?? [];
  const [latestBurn, priorBurn] = org?.burnSnapshots ?? [];
  const pendingApprovals = org?.approvalRequests ?? [];
  const latestEvent = org?.events[0];

  const burnDeltaPct =
    latestBurn && priorBurn
      ? ((latestBurn.monthlyBurn - priorBurn.monthlyBurn) / priorBurn.monthlyBurn) * 100
      : null;
  const runwayDeltaMonths =
    latestRunway && priorRunway ? latestRunway.runwayMonths - priorRunway.runwayMonths : null;

  const goalPct = activeGoal ? (activeGoal.currentValue / activeGoal.targetValue) * 100 : 0;
  // A crude but legible projection: same-slope-forward using current trajectory delta.
  const projectedPct = activeGoal ? Math.min(100, goalPct + (runwayDeltaMonths ?? 0) * 2) : 0;
  const onTrack = (runwayDeltaMonths ?? 0) >= 0;

  // The causal chain shown on the homepage: derived from the most recent event
  // and its downstream effects (task + approval), when present — otherwise a
  // calm "nothing material changed" placeholder.
  const chainLinks: CausalLink[] = [];
  if (latestEvent) {
    chainLinks.push({
      kind: "Signal",
      title: `${latestEvent.entityType} event via ${latestEvent.source}`,
      detail: latestEvent.processed ? "Observed and classified" : "Awaiting classification",
      tone: latestEvent.processed ? "neutral" : "warning",
    });
    if (latestBurn && priorBurn && burnDeltaPct !== null && Math.abs(burnDeltaPct) > 1) {
      chainLinks.push({
        kind: "Consequence",
        title: `Burn ${burnDeltaPct > 0 ? "up" : "down"} ${Math.abs(burnDeltaPct).toFixed(0)}%`,
        detail: runwayDeltaMonths !== null ? `Runway moved ${runwayDeltaMonths.toFixed(1)} mo` : undefined,
        tone: burnDeltaPct > 0 ? "risk" : "positive",
      });
    }
    if (org?.tasks[0]) {
      chainLinks.push({
        kind: "Response",
        title: org.tasks[0].title,
        detail: org.tasks[0].why,
        tone: "action",
      });
    }
    if (pendingApprovals[0]) {
      chainLinks.push({
        kind: "Awaiting authority",
        title: "Human approval required",
        detail: pendingApprovals[0].reason ?? undefined,
        tone: "warning",
      });
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-10">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display-heading text-display-lg text-ink-primary">
            {org?.name || "Company Pulse"}
          </h1>
          <p className="mt-1 text-body-sm text-ink-secondary">
            What&apos;s happening, what matters, and what Axiom is doing about it
          </p>
        </div>
        <div className="flex items-center gap-4">
          <AgentState agent="Observer" activity={latestEvent?.processed ? "idle" : "investigating"} />
          <span
            className={`inline-flex items-center gap-2 rounded-sm border border-hairline px-2.5 py-1 text-body-sm ${
              health.ok ? "text-trajectory-positive" : "text-signal-risk"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${health.ok ? "bg-trajectory-positive" : "bg-signal-risk"}`}
              aria-hidden="true"
            />
            {health.ok ? `agent-service: ${health.status}` : `agent-service unreachable`}
          </span>
        </div>
      </div>

      <DemoControls />

      {/* Trajectory — the showpiece: where the company is / heading / needs to be */}
      <Surface tier={1} className="p-5 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="display-heading text-display-sm text-ink-primary">
            {activeGoal?.title ?? "Trajectory"}
          </h2>
          <span className={`text-body-sm font-num ${onTrack ? "text-trajectory-positive" : "text-trajectory-negative"}`}>
            {onTrack ? "On track" : "Off track"}
          </span>
        </div>

        {activeGoal && (
          <TrajectoryLine
            currentPct={goalPct}
            projectedPct={projectedPct}
            currentLabel={formatINR(activeGoal.currentValue)}
            projectedLabel={formatINR(
              Math.round(activeGoal.targetValue * (projectedPct / 100))
            )}
            targetLabel={formatINR(activeGoal.targetValue)}
            onTrack={onTrack}
          />
        )}

        <div className="grid grid-cols-2 gap-6 border-t border-hairline pt-5 sm:grid-cols-4">
          <Metric
            label="Runway"
            value={latestRunway ? latestRunway.runwayMonths.toFixed(1) : "—"}
            unit="months"
            delta={runwayDeltaMonths !== null ? `${runwayDeltaMonths >= 0 ? "+" : ""}${runwayDeltaMonths.toFixed(1)} mo` : undefined}
            deltaDirection={runwayDeltaMonths === null ? "neutral" : runwayDeltaMonths >= 0 ? "positive" : "negative"}
            size="md"
          />
          <Metric
            label="Cash on hand"
            value={latestRunway ? formatINR(latestRunway.cashOnHand) : "—"}
            size="md"
          />
          <Metric
            label="Monthly burn"
            value={latestBurn ? formatINR(latestBurn.monthlyBurn) : "—"}
            delta={burnDeltaPct !== null ? `${burnDeltaPct >= 0 ? "+" : ""}${burnDeltaPct.toFixed(0)}%` : undefined}
            deltaDirection={burnDeltaPct === null ? "neutral" : burnDeltaPct <= 0 ? "positive" : "negative"}
            size="md"
          />
          <Metric
            label={activeGoal?.metric ?? "ARR"}
            value={activeGoal ? formatINR(activeGoal.currentValue) : "—"}
            delta={activeGoal ? `${goalPct.toFixed(0)}% of target` : undefined}
            deltaDirection="neutral"
            size="md"
          />
        </div>
      </Surface>

      {/* Causality — what changed, what it caused, what Axiom is doing */}
      {chainLinks.length > 0 && (
        <section className="space-y-2">
          <h2 className="display-heading text-display-sm text-ink-primary">What changed</h2>
          <CausalChain links={chainLinks} />
        </section>
      )}

      {/* Operational overview — composed, not identical cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Surface tier={1} className="col-span-2 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="display-heading text-display-sm text-ink-primary">
              Proactive tasks ({org?.tasks.length ?? 0})
            </h2>
          </div>
          <div className="divide-y divide-hairline">
            {org?.tasks.length ? (
              org.tasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="text-body font-medium text-ink-primary">{task.title}</div>
                    <div className="text-body-sm text-ink-secondary">{task.why}</div>
                  </div>
                  <span className="whitespace-nowrap text-body-sm font-num text-signal-warning">
                    {task.priority}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-3 text-body-sm text-ink-faint">
                No open tasks — nothing needs your attention right now.
              </p>
            )}
          </div>
        </Surface>

        <Surface tier={1} className="p-5 space-y-3">
          <h2 className="display-heading text-display-sm text-ink-primary">Awaiting your authority</h2>
          <div className="space-y-3">
            {pendingApprovals.length ? (
              pendingApprovals.map((req) => (
                <div key={req.id} className="space-y-1.5 border-b border-hairline pb-3 last:border-0 last:pb-0">
                  <AuthorityBadge state="awaiting_approval" />
                  <p className="text-body-sm text-ink-secondary">{req.reason ?? "Requires human approval"}</p>
                </div>
              ))
            ) : (
              <p className="text-body-sm text-ink-faint">Nothing is waiting on you.</p>
            )}
          </div>
        </Surface>
      </div>

      <Surface tier={1} className="p-5 space-y-3">
        <h2 className="display-heading text-display-sm text-ink-primary">Active decisions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {org?.decisions.length ? (
            org.decisions.map((decision) => (
              <Surface key={decision.id} tier={2} className="p-3 space-y-1">
                <div className="text-body font-medium text-ink-primary">{decision.title}</div>
                <p className="text-body-sm text-ink-secondary">{decision.reason}</p>
              </Surface>
            ))
          ) : (
            <p className="text-body-sm text-ink-faint">No standing decisions on record yet.</p>
          )}
        </div>
      </Surface>
    </main>
  );
}
