import { RAIDS, type RaidKillDifficulty } from "@/game/raidSeason";
import type { RaidKillDTO } from "@/data/source";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ported plain-JS module, no type declarations
import { fetchRaidZones } from "./raidZones.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ported plain-JS module, no type declarations
import { fetchEncounterDifficultyRuns } from "./api.js";

// Highest first - short-circuit on the first difficulty with any ranked run,
// since that's already the answer (the highest actually cleared). WCL
// difficulty codes confirmed live: 1=LFR, 3=Normal, 4=Heroic, 5=Mythic (2 is
// unused - a legacy 10/25-man Normal split from older WoW versions).
const DIFFICULTY_CHECK_ORDER: [number, RaidKillDifficulty][] = [
  [5, "mythic"],
  [4, "heroic"],
  [3, "normal"],
  [1, "lfr"],
];

// Boss names can differ in punctuation between our static list and WCL's live
// zone data (apostrophes, commas) - match loosely, same idea as
// DungeonGrid.tsx's normalizeDungeonName.
function normalizeBossName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’'`]/g, "")
    .replace(/[:,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pulls live boss/encounterID data from WCL and, for each boss on our
 * static raid list, checks each difficulty (Mythic -> Heroic -> Normal ->
 * LFR, stopping at the first with any ranked run) for the highest actually
 * cleared - no DB row required, nothing persisted. Bosses are checked in
 * parallel (each still short-circuits its own difficulty chain) since this
 * can be called synchronously from a page render, not just an on-demand
 * button click.
 *
 * Used both by the owned-character sync route (which persists the result to
 * the DB) and the universal live player-search fallback (which can't - an
 * unregistered character has no DB row to persist to). */
export async function fetchLiveRaidKills({
  name, realmSlug, region,
}: {
  name: string;
  realmSlug: string;
  region: string;
}): Promise<RaidKillDTO[]> {
  const zones = await fetchRaidZones();
  const encounterIdByName = new Map<string, number>();
  for (const zone of zones) {
    for (const enc of zone.encounters ?? []) {
      encounterIdByName.set(normalizeBossName(enc.name), enc.id);
    }
  }

  const bossEntries = RAIDS.flatMap((raid) => raid.bosses.map((boss) => ({ raid, boss })));
  const results = await Promise.all(
    bossEntries.map(async ({ raid, boss }): Promise<RaidKillDTO | null> => {
      const encounterID = encounterIdByName.get(normalizeBossName(boss.name));
      if (!encounterID) return null; // not on WCL's currently-live zone list

      try {
        for (const [difficulty, label] of DIFFICULTY_CHECK_ORDER) {
          const runs = await fetchEncounterDifficultyRuns({
            name,
            serverSlug: realmSlug,
            serverRegion: region.toUpperCase(),
            encounterID,
            difficulty,
          });
          if (runs.length > 0) {
            return { raidId: raid.id, bossId: boss.id, difficulty: label };
          }
        }
      } catch {
        // one boss failing (never logged, WCL hiccup) shouldn't abort the rest
      }
      return null;
    })
  );

  return results.filter((k): k is RaidKillDTO => k != null);
}
