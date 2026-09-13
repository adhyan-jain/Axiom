/**
 * TrajectoryLine — where the company is / where it's heading / where it
 * needs to be, as a single visual line rather than a progress bar vs a
 * static target. `current` and `projected` are both plotted against
 * `target` on a 0-100 track; the gap between them communicates momentum.
 */
export function TrajectoryLine({
  currentPct,
  projectedPct,
  targetLabel,
  currentLabel,
  projectedLabel,
  onTrack,
}: {
  currentPct: number;
  projectedPct: number;
  targetLabel: string;
  currentLabel: string;
  projectedLabel: string;
  onTrack: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const cur = clamp(currentPct);
  const proj = clamp(projectedPct);
  const trackColor = onTrack ? "bg-trajectory-positive" : "bg-trajectory-negative";

  return (
    <div className="space-y-2">
      <div className="relative h-2 rounded-full bg-surface-3">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${trackColor} transition-all duration-500 ease-axiom`}
          style={{ width: `${cur}%` }}
        />
        {/* projected marker */}
        <div
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-ink-primary/70"
          style={{ left: `${proj}%` }}
          aria-hidden="true"
        />
        {/* target marker */}
        <div
          className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-ink-faint"
          style={{ left: "100%" }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between text-body-sm text-ink-secondary">
        <span>
          Now: <span className="font-num text-ink-primary">{currentLabel}</span>
        </span>
        <span>
          Projected: <span className="font-num text-ink-primary">{projectedLabel}</span>
        </span>
        <span>
          Target: <span className="font-num text-ink-primary">{targetLabel}</span>
        </span>
      </div>
    </div>
  );
}
