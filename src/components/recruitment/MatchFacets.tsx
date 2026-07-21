"use client";

import type { MatchFacet } from "@/game/recruitmentMatch";
import { cn } from "@/lib/utils";

/** Each level gets a glyph AND a word, never colour alone - the whole point of
 * this component is that a recruiter can read WHY someone fits, and colour is
 * not readable for everyone. */
const LEVEL: Record<MatchFacet["level"], { glyph: string; label: string; className: string }> = {
  strong: { glyph: "✓", label: "Strong match", className: "text-emerald-400" },
  partial: { glyph: "~", label: "Partial match", className: "text-gold" },
  none: { glyph: "×", label: "Not a match", className: "text-gray-500" },
};

/** Renders the per-dimension explanations from explainApplication.
 *
 * There is deliberately no summary score anywhere in this component. Each
 * facet stands alone, which is the product rule: a recruiter is told what
 * matches and what does not, and decides for themselves. */
export function MatchFacets({
  facets,
  compact = false,
  className,
}: {
  facets: MatchFacet[];
  /** Cards show only the facets that say something positive; the drawer shows
   * everything including the misses. */
  compact?: boolean;
  className?: string;
}) {
  const shown = compact ? facets.filter((f) => f.level !== "none").slice(0, 3) : facets;
  if (!shown.length) return null;

  return (
    <ul className={cn("space-y-1", className)}>
      {shown.map((f, i) => {
        const level = LEVEL[f.level];
        return (
          <li key={i} className="flex items-start gap-1.5 text-xs">
            <span
              aria-hidden="true"
              className={cn("mt-px shrink-0 font-bold", level.className)}
              title={level.label}
            >
              {level.glyph}
            </span>
            <span className="sr-only">{level.label}:</span>
            <span className="text-gray-300">
              {f.reason}
              {!compact && f.detail && <span className="block text-gray-600">{f.detail}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The compatibility heading a group of candidates sits under.
 *
 * Says how many dimensions matched, not a percentage - "4 strong matches" is
 * checkable against the list below it, where "87%" would be an unexplained
 * number the spec explicitly rules out. */
export function CompatibilityHeading({ strongCount, count }: { strongCount: number; count: number }) {
  const label =
    strongCount === 0
      ? "Some overlap"
      : `${strongCount} strong match${strongCount === 1 ? "" : "es"}`;
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{label}</h3>
      <span className="text-[11px] text-gray-600">
        {count} applicant{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}
