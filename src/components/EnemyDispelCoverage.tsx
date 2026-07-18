"use client";

import type { BasicCoverage } from "@/game/coverage";
import { CoverageSection } from "./CoverageSection";

/** Have / Want / Missing breakdown for enemy magic dispels and Enrage
 * removal (Purge, Consume Magic, Spellsteal, Dispel Magic, Tranquilizing
 * Shot, Devour Magic, Soothe, Shiv, Oppressing Roar + Overawe). */
export function EnemyDispelCoverage({
  coverage, defaultOpen = false,
}: { coverage: BasicCoverage; defaultOpen?: boolean }) {
  return <CoverageSection label="Enemy Magic Dispels" coverage={coverage} defaultOpen={defaultOpen} />;
}
