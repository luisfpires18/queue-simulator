// Raider.IO public API client â€” no auth needed (unlike Blizzard's profile
// API, which requires the signed-in user's own OAuth token). Used instead of
// Blizzard's own mythic-keystone-profile fetch because Blizzard's API only
// ever exposes ONE best run per dungeon overall (whichever spec scored
// highest) â€” a secondary spec's real runs simply never appear if they didn't
// happen to be the character's single best. Raider.io's own per-spec SCORE
// (mythic_plus_scores_by_season) is still exact â€” but its public run-listing
// fields are each a top-10-by-some-metric subset (verified against their own
// /swagger.json), not the complete history their own website shows via a
// private API. So the season score matches raider.io exactly; the per-run
// "keys this season" grid is best-effort and can miss a spec's own runs on
// dungeons it was never impressive on.
import type { DungeonBestRun } from "./dto";
import { SPEC_ID_TO_SPEC_ID as SPEC_ID_MAP, classIdFromName, specIdFromNames } from "@/game/blizzardMap";

const API_HOST = "https://raider.io/api/v1";

interface RaiderIoRun {
  dungeon: string;
  zone_id: number;
  mythic_level: number;
  score: number;
  num_keystone_upgrades: number;
  completed_at: string;
  spec: { id: number; name: string };
}

interface RaiderIoProfile {
  mythic_plus_scores_by_season?: { season: string; scores: Record<string, number> }[];
  mythic_plus_ranks?: Record<string, unknown>;
  gear?: { item_level_equipped?: number };
  // Identity fields â€” raider.io always returns these on a valid character
  // (not gated by the `fields` param, unlike scores/gear/runs below).
  // Only meaningfully consumed by the universal player-search feature
  // (src/data/livePlayer.ts), which has no local Character row to source
  // classId/faction/realm-display-name from otherwise.
  class?: string;
  faction?: string;
  realm?: string;
  active_spec_name?: string;
  // None of raider.io's public run-listing fields return a character's full
  // run history â€” each is a top-10-by-some-metric subset (confirmed against
  // their own /swagger.json docs), unlike the richer per-spec table their own
  // website shows (which comes from a private, undocumented internal API).
  // Union every public field so we recover as much real per-spec/per-dungeon
  // coverage as the public API can give â€” still won't be perfectly complete
  // for a spec played only at low, unremarkable levels (those runs never
  // crack any of these top-10 cuts).
  mythic_plus_recent_runs?: RaiderIoRun[];
  mythic_plus_best_runs?: RaiderIoRun[];
  mythic_plus_highest_level_runs?: RaiderIoRun[];
  mythic_plus_weekly_highest_level_runs?: RaiderIoRun[];
  mythic_plus_previous_weekly_highest_level_runs?: RaiderIoRun[];
}

export interface RaiderIoRatingResult {
  overallRating: number | null;
  ilvl: number | null;
  specScores: { specId: string; score: number }[];
  bestRunsBySpec: Record<string, DungeonBestRun[]>;
  // Identity - only meaningfully populated for a character with no local DB
  // row to source these from (see src/data/livePlayer.ts); existing callers
  // with a real Character row already know these and can ignore them.
  classId: string | null;
  faction: string | null;
  activeSpecId: string | null;
  realmName: string | null;
}

/** Real M+ rating + per-spec breakdown + this season's per-dungeon best runs,
 * straight from raider.io's own public API â€” the same numbers their site shows. */
export async function fetchRaiderIoRating(
  region: string,
  realmSlug: string,
  name: string
): Promise<RaiderIoRatingResult> {
  const params = new URLSearchParams({
    region,
    realm: realmSlug,
    name,
    fields: [
      "mythic_plus_scores_by_season:current",
      "mythic_plus_ranks",
      "mythic_plus_recent_runs",
      "mythic_plus_best_runs:all",
      "mythic_plus_highest_level_runs",
      "mythic_plus_weekly_highest_level_runs",
      "mythic_plus_previous_weekly_highest_level_runs",
      "gear",
    ].join(","),
  });
  const res = await fetch(`${API_HOST}/characters/profile?${params}`, { cache: "no-store" });
  if (!res.ok) {
    return {
      overallRating: null, ilvl: null, specScores: [], bestRunsBySpec: {},
      classId: null, faction: null, activeSpecId: null, realmName: null,
    };
  }
  const data = (await res.json()) as RaiderIoProfile;

  const season = data.mythic_plus_scores_by_season?.[0];
  const overallRating = typeof season?.scores?.all === "number" ? season.scores.all : null;
  const ilvl = typeof data.gear?.item_level_equipped === "number" ? Math.round(data.gear.item_level_equipped) : null;
  // Base profile fields raider.io always returns (not gated by `fields`) -
  // only meaningfully consumed by callers with no local Character row to
  // source class/faction/active-spec/realm-display-name from (see
  // src/data/livePlayer.ts).
  const classId = classIdFromName(data.class);
  const faction = data.faction ?? null;
  const activeSpecId = specIdFromNames(data.class, data.active_spec_name);
  const realmName = data.realm ?? null;

  // scores.spec_0/1/2/3 are ordinal â€” positional, not keyed by real spec id.
  // mythic_plus_ranks' own spec_<realId> keys come back in that same ordinal
  // order (empirically verified against live Mage/Druid/Demon Hunter
  // profiles â€” notably Demon Hunter, where the new Devourer spec is APPENDED
  // after the original Havoc/Vengeance pair rather than inserted between
  // them, so a hardcoded per-class ordinal table would get it wrong).
  const rankSpecIds = Object.keys(data.mythic_plus_ranks ?? {})
    .filter((k) => k.startsWith("spec_"))
    .map((k) => Number(k.slice(5)));

  const specScores: { specId: string; score: number }[] = [];
  if (season) {
    rankSpecIds.forEach((blizzardSpecId, i) => {
      const score = season.scores[`spec_${i}`];
      const specId = SPEC_ID_MAP[blizzardSpecId];
      if (specId && typeof score === "number" && score > 0) specScores.push({ specId, score });
    });
  }

  // `${specId}|${dungeonId}` -> the best (highest-score) run seen for that
  // pair, across every run-listing field the public API offers â€” each field
  // is its own top-10 cut, so a run missing from one may still surface in
  // another (see the field-list comment above).
  const allRuns = [
    ...(data.mythic_plus_recent_runs ?? []),
    ...(data.mythic_plus_best_runs ?? []),
    ...(data.mythic_plus_highest_level_runs ?? []),
    ...(data.mythic_plus_weekly_highest_level_runs ?? []),
    ...(data.mythic_plus_previous_weekly_highest_level_runs ?? []),
  ];
  const bestPerSpecDungeon = new Map<string, { specId: string; run: DungeonBestRun }>();
  for (const run of allRuns) {
    const specId = SPEC_ID_MAP[run.spec.id];
    if (!specId) continue;
    const key = `${specId}|${run.zone_id}`;
    const existing = bestPerSpecDungeon.get(key);
    if (!existing || existing.run.score < run.score) {
      bestPerSpecDungeon.set(key, {
        specId,
        run: {
          dungeonId: run.zone_id,
          dungeonName: run.dungeon,
          level: run.mythic_level,
          score: run.score,
          timed: run.num_keystone_upgrades > 0,
          completedAt: Date.parse(run.completed_at) || null,
        },
      });
    }
  }

  const bestRunsBySpec: Record<string, DungeonBestRun[]> = {};
  for (const { specId, run } of bestPerSpecDungeon.values()) {
    (bestRunsBySpec[specId] ??= []).push(run);
  }

  return { overallRating, ilvl, specScores, bestRunsBySpec, classId, faction, activeSpecId, realmName };
}
