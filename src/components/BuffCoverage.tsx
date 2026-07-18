"use client";

import type { BasicCoverage } from "@/game/coverage";
import { CoverageSection } from "./CoverageSection";

/** Have / Want / Missing breakdown for party buffs/debuffs (Fort, Arcane Int,
 * Battle Shout, MotW, Skyfury, Chaos Brand, Mystic Touch, ...). */
export function BuffCoverage({
  coverage, defaultOpen = false,
}: { coverage: BasicCoverage; defaultOpen?: boolean }) {
  return <CoverageSection label="Buffs & Debuffs" coverage={coverage} defaultOpen={defaultOpen} />;
}
