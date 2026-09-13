import { Surface, TrajectoryLine, CausalChain } from "@/components/primitives";
import type { CausalLink } from "@/components/primitives";

type ScenarioOption = {
  label?: string;
  projected_runway_months?: number;
  runway_delta_months?: number;
  projected_burn?: number;
  [key: string]: unknown;
};

type ScenarioLike = {
  id: string;
  question: string;
  options: unknown;
  recommendation: string;
  createdAt: string | Date;
};

/** A runway ceiling used purely to render TrajectoryLine's 0-100 track for scenarios —
 * scenarios reason in months, not currency, so this repurposes the same primitive used
 * for the ARR trajectory on Home with a different axis. 24 months reads as "full bar"
 * for an early-stage runway comparison. */
const RUNWAY_CEILING_MONTHS = 24;

function pct(months: number | undefined) {
  if (months === undefined || Number.isNaN(months)) return 0;
  return Math.max(0, Math.min(100, (months / RUNWAY_CEILING_MONTHS) * 100));
}

/**
 * ScenarioCard — branch comparison: today -> option A vs option B -> runway deltas
 * (TrajectoryLine per option) -> recommendation + trigger condition (CausalChain).
 */
export default function ScenarioCard({ scenario, currentRunwayMonths }: { scenario: ScenarioLike; currentRunwayMonths: number | null }) {
  const options: ScenarioOption[] = Array.isArray(scenario.options) ? (scenario.options as ScenarioOption[]) : [];
  const recommendedOption = options.find(
    (opt) => opt.label && scenario.recommendation.toLowerCase().includes(String(opt.label).toLowerCase().split(":")[0])
  );

  const chainLinks: CausalLink[] = [
    { kind: "Today", title: currentRunwayMonths !== null ? `${currentRunwayMonths.toFixed(1)} months runway` : "Current state", tone: "neutral" },
    { kind: "Recommendation", title: scenario.recommendation, tone: "action" },
  ];

  return (
    <Surface tier={1} className="space-y-5 p-6">
      <h2 className="display-heading text-display-sm text-ink-primary">&quot;{scenario.question}&quot;</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((opt, idx) => {
          const isRecommended = recommendedOption === opt;
          const onTrack = (opt.runway_delta_months ?? 0) >= 0;
          return (
            <Surface
              key={idx}
              tier={2}
              className={`space-y-3 p-4 ${isRecommended ? "border-signal-action/50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-ink-primary">{opt.label ?? `Option ${idx + 1}`}</span>
                {isRecommended && (
                  <span className="rounded-sm border border-signal-action/40 bg-signal-action/10 px-1.5 py-0.5 text-body-sm text-signal-action">
                    Recommended
                  </span>
                )}
              </div>
              <TrajectoryLine
                currentPct={pct(currentRunwayMonths ?? undefined)}
                projectedPct={pct(opt.projected_runway_months)}
                currentLabel={currentRunwayMonths !== null ? `${currentRunwayMonths.toFixed(1)} mo` : "—"}
                projectedLabel={opt.projected_runway_months !== undefined ? `${opt.projected_runway_months.toFixed(1)} mo` : "—"}
                targetLabel={`${RUNWAY_CEILING_MONTHS} mo`}
                onTrack={onTrack}
              />
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-ink-secondary">Runway delta</span>
                <span className={`font-num ${onTrack ? "text-trajectory-positive" : "text-trajectory-negative"}`}>
                  {opt.runway_delta_months !== undefined
                    ? `${opt.runway_delta_months >= 0 ? "+" : ""}${opt.runway_delta_months.toFixed(1)} mo`
                    : "—"}
                </span>
              </div>
            </Surface>
          );
        })}
      </div>

      <CausalChain links={chainLinks} />

      <p className="text-body-sm text-ink-faint">Evaluated {new Date(scenario.createdAt).toLocaleString()}</p>
    </Surface>
  );
}
