"use client";

import type { BasicCoverage } from "@/game/coverage";
import { CoverageSection } from "./CoverageSection";

/** Have / Want / Missing breakdown for spec-locked party defensives (AMZ,
 * Darkness, Zephyr, Rallying Cry, Aura Mastery, Power Word: Barrier, Spirit
 * Link Totem, Revival, Rewind). */
export function DefensiveCoverage({
  coverage, defaultOpen = false,
}: { coverage: BasicCoverage; defaultOpen?: boolean }) {
  return <CoverageSection label="Party Defensives" coverage={coverage} defaultOpen={defaultOpen} />;
}
