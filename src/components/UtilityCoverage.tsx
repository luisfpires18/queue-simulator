"use client";

import type { Coverage } from "@/game/coverage";
import { CoverageSection } from "./CoverageSection";

/** Have / Want / Missing breakdown for Lust, Battle Res and external/party
 * utility (Power Infusion, Innervate, Blessing of Freedom, Rescue, Leap of
 * Faith, Cauterizing Flame, Mass Dispel). Flags a warning when Lust or Battle
 * Res is fully missing (not even wanted). */
export function UtilityCoverage({
  coverage, defaultOpen = false,
}: { coverage: Coverage; defaultOpen?: boolean }) {
  const warning = coverage.warning ? (
    <span className="chip bg-rose-500/15 border border-rose-500/50 text-rose-200 text-[10px]">
      ⚠ Missing {coverage.lust === "missing" ? "Lust" : ""}
      {coverage.lust === "missing" && coverage.res === "missing" ? " + " : ""}
      {coverage.res === "missing" ? "Res" : ""}
    </span>
  ) : null;

  return <CoverageSection label="Utility" coverage={coverage} defaultOpen={defaultOpen} warning={warning} />;
}
