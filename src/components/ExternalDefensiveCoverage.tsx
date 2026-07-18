"use client";

import type { BasicCoverage } from "@/game/coverage";
import { CoverageSection } from "./CoverageSection";

/** Have / Want / Missing breakdown for single-target external defensives
 * (Pain Suppression, Guardian Spirit, Ironbark, Life Cocoon, Time Dilation,
 * Blessing of Sacrifice/Protection/Spellwarding). */
export function ExternalDefensiveCoverage({
  coverage, defaultOpen = false,
}: { coverage: BasicCoverage; defaultOpen?: boolean }) {
  return <CoverageSection label="External Defensives" coverage={coverage} defaultOpen={defaultOpen} />;
}
