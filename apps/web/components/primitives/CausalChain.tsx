export interface CausalLink {
  /** Short kind label, e.g. "SIGNAL", "CONSEQUENCE", "RECOMMENDATION" */
  kind: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "warning" | "risk" | "positive" | "action";
}

const TONE_COLOR: Record<NonNullable<CausalLink["tone"]>, string> = {
  neutral: "border-ink-faint text-ink-secondary",
  warning: "border-signal-warning text-signal-warning",
  risk: "border-signal-risk text-signal-risk",
  positive: "border-trajectory-positive text-trajectory-positive",
  action: "border-signal-action text-signal-action",
};

/**
 * CausalChain — renders a signal → consequence → response chain as a
 * connected sequence, not a paragraph. Reused on Home, Events, and
 * Decisions (conflict view). Horizontal on wide screens, vertical rail
 * on narrow ones.
 */
export function CausalChain({ links }: { links: CausalLink[] }) {
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
      {links.map((link, i) => {
        const tone = link.tone ?? "neutral";
        const isLast = i === links.length - 1;
        return (
          <li key={i} className="flex flex-1 sm:flex-row items-stretch">
            <div
              className={`flex-1 rounded border-l-2 ${TONE_COLOR[tone]} bg-surface-2 px-3 py-2 animate-trace-in`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="text-micro uppercase text-ink-faint">{link.kind}</div>
              <div className="text-body-sm font-medium text-ink-primary">{link.title}</div>
              {link.detail && (
                <div className="mt-0.5 text-body-sm text-ink-secondary">{link.detail}</div>
              )}
            </div>
            {!isLast && (
              <div
                className="flex shrink-0 items-center justify-center px-2 text-ink-faint sm:px-2"
                aria-hidden="true"
              >
                <span className="hidden sm:inline">→</span>
                <span className="sm:hidden">↓</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
