import type { ReactNode } from "react";

/**
 * Layered surface — depth via elevation tier + hairline border, never
 * drop-shadow. Tier 1 = page-level panel, tier 2 = nested panel/row,
 * tier 3 = inset (e.g. a chip inside a row).
 */
export function Surface({
  tier = 1,
  className = "",
  children,
  as: Tag = "div",
}: {
  tier?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
}) {
  const bg = tier === 1 ? "bg-surface-1" : tier === 2 ? "bg-surface-2" : "bg-surface-3";
  return (
    <Tag className={`${bg} border border-hairline rounded ${className}`}>
      {children}
    </Tag>
  );
}
