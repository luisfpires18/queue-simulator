"use client";

import type { BasicCoverage } from "@/game/coverage";
import { CoverageSection } from "./CoverageSection";

/** Have / Want / Missing breakdown for friendly dispels (Magic, Curse,
 * Poison, Disease, Bleed removal). */
export function DispelCoverage({
  coverage, defaultOpen = false,
}: { coverage: BasicCoverage; defaultOpen?: boolean }) {
  return <CoverageSection label="Friendly Dispels" coverage={coverage} defaultOpen={defaultOpen} />;
}
