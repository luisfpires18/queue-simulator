import { DUNGEONS } from "./season";
import type { SpecTrackDTO, DungeonBestRun } from "@/data/dto";

// raider.io's `dungeon` string and our own DUNGEONS[].name can differ in
// punctuation (apostrophe placement, colons, dashes) even when they mean the
// same zone — match loosely rather than requiring byte-exact equality. Used
// by DungeonGrid.tsx (per-spec display) and the account-wide achievement
// check below (characterDungeonAchievement).
export function normalizeDungeonName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’'`]/g, "") // apostrophes: "Magister's" / "Magisters'" -> "magisters"
    .replace(/[:-]/g, " ") // colons/dashes become word breaks, not glued-together words
    .replace(/\s+/g, " ")
    .trim();
}

/** For each of this season's 8 dungeons, the character's best TIMED run at
 * that dungeon across ALL tracked specs (not just one) — an account-wide
 * "what can this character actually clear", not spec-locked. Untimed/unknown
 * runs don't count here (see meetsResilientRequirement's "must be timed"
 * definition) even though DungeonGrid.tsx shows them for informational
 * purposes elsewhere. */
export function characterDungeonAchievement(specTracks: SpecTrackDTO[]): Map<string, DungeonBestRun> {
  const best = new Map<string, DungeonBestRun>();
  for (const dungeon of DUNGEONS) {
    const normalizedName = normalizeDungeonName(dungeon.name);
    let bestRun: DungeonBestRun | null = null;
    for (const track of specTracks) {
      for (const run of track.bestRuns) {
        if (run.timed !== true) continue;
        if (normalizeDungeonName(run.dungeonName) !== normalizedName) continue;
        if (!bestRun || run.level > bestRun.level) bestRun = run;
      }
    }
    if (bestRun) best.set(dungeon.id, bestRun);
  }
  return best;
}

/** "Resilient Key +N" — every one of this season's 8 dungeons timed at level N or higher. */
export function meetsResilientRequirement(achievement: Map<string, DungeonBestRun>, level: number): boolean {
  return DUNGEONS.every((d) => (achievement.get(d.id)?.level ?? 0) >= level);
}

/** Resilient baseline at `baseLevel`, PLUS at least `extraCount` dungeons
 * additionally timed at `extraLevel` or higher (extraLevel > baseLevel) —
 * models e.g. "Resilient +21, plus 1-2 dungeons timed at +22". */
export function meetsCustomRequirement(
  achievement: Map<string, DungeonBestRun>,
  baseLevel: number,
  extraCount: number,
  extraLevel: number
): boolean {
  if (!meetsResilientRequirement(achievement, baseLevel)) return false;
  const extraDone = DUNGEONS.filter((d) => (achievement.get(d.id)?.level ?? 0) >= extraLevel).length;
  return extraDone >= extraCount;
}
