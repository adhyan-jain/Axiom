/**
 * Metric — the primary numeric-truth primitive. ARR/burn/runway/deltas
 * all render through this so precision reads consistently everywhere.
 */
export function Metric({
  label,
  value,
  unit,
  delta,
  deltaDirection,
  size = "lg",
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  /** "positive" = toward goal, "negative" = away from goal, "neutral" = informational */
  deltaDirection?: "positive" | "negative" | "neutral";
  size?: "lg" | "md" | "sm";
}) {
  const valueSize =
    size === "lg" ? "text-display-lg" : size === "md" ? "text-display-md" : "text-display-sm";
  const deltaColor =
    deltaDirection === "positive"
      ? "text-trajectory-positive"
      : deltaDirection === "negative"
        ? "text-trajectory-negative"
        : "text-ink-secondary";

  return (
    <div className="space-y-1">
      <div className="text-micro uppercase text-ink-faint">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`font-num font-num ${valueSize} text-ink-primary`}>{value}</span>
        {unit && <span className="text-body-sm text-ink-secondary">{unit}</span>}
      </div>
      {delta && (
        <div className={`font-num text-body-sm ${deltaColor} flex items-center gap-1`}>
          <span aria-hidden="true">
            {deltaDirection === "positive" ? "▲" : deltaDirection === "negative" ? "▼" : "•"}
          </span>
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}
