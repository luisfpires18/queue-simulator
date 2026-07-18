// Midnight — Season 1 (patch 12.0.7, live 2026-03-17). Config-only.

export interface DungeonDef {
  id: string;
  name: string;
  abbr: string;
  origin: string; // where the dungeon is from
  blizzardDungeonId: number; // Blizzard's map_challenge_mode_id — verified live against the Season 1 leaderboard API
  icon: string; // Blizzard "Keystone Hero: <dungeon>" achievement icon slug (same set raider.io uses)
}

export const SEASON = {
  expansion: "Midnight",
  season: 1,
  patch: "12.0.7",
};

// Season 1's 8-dungeon pool. When S2 rotates the pool, edit this array only —
// everything that reads DUNGEONS/DUNGEON_BY_ID (board, list form, comp
// analyzer) picks the change up with no code change.
export const DUNGEONS: DungeonDef[] = [
  { id: "mgt", name: "Magister's Terrace", abbr: "MT", origin: "Midnight", blizzardDungeonId: 558, icon: "inv_achievement_dungeon_magistersterrace" },
  { id: "maisara", name: "Maisara Caverns", abbr: "MC", origin: "Midnight", blizzardDungeonId: 560, icon: "inv_achievement_dungeon_maisarahills" },
  { id: "nexus", name: "Nexus Point: Xenas", abbr: "NPX", origin: "Midnight", blizzardDungeonId: 559, icon: "inv_achievement_dungeon_nexuspointxenas" },
  { id: "wspire", name: "Windrunner Spire", abbr: "WS", origin: "Midnight", blizzardDungeonId: 557, icon: "inv_achievement_dungeon_windrunnerspire" },
  { id: "aa", name: "Algeth'ar Academy", abbr: "AA", origin: "Dragonflight", blizzardDungeonId: 402, icon: "achievement_dungeon_dragonacademy" },
  { id: "pos", name: "Pit of Saron", abbr: "POS", origin: "Wrath", blizzardDungeonId: 556, icon: "achievement_dungeon_icecrown_pitofsaron" },
  { id: "sott", name: "Seat of the Triumvirate", abbr: "SEAT", origin: "Legion", blizzardDungeonId: 239, icon: "achievement_dungeon_argusdungeon" },
  { id: "sky", name: "Skyreach", abbr: "SR", origin: "Warlords", blizzardDungeonId: 161, icon: "achievement_dungeon_arakkoaspires" },
];

export const DUNGEON_BY_ID: Record<string, DungeonDef> = Object.fromEntries(
  DUNGEONS.map((d) => [d.id, d])
);

export const DUNGEON_BY_BLIZZARD_ID: Record<number, DungeonDef> = Object.fromEntries(
  DUNGEONS.map((d) => [d.blizzardDungeonId, d])
);

// Seasonal affix flavor for card display.
export const AFFIXES = ["Fortified / Tyrannical", "Xal'atath's Guile", "Challenger's Peril"];

// M+ rating -> tier. These are raider.io's OWN real tier breakpoints and
// colors (their `scoreTiersSimple` table — verified against the actual
// open-source RaiderIO/raiderio-addon repo, db/db_score_tiers.lua), not a
// made-up scale — standard WoW item-quality colors at raider.io's real score
// thresholds, so a character's color here matches what raider.io itself
// would show. (Raider.io's full addon gradient has ~170 finer stops between
// these for a smoother fade; this is their own simplified tier set, which is
// what a badge/text color realistically needs.)
export interface RatingTier {
  id: string;
  label: string;
  min: number;
  colorVar: string; // tailwind color token (tier.*)
  hex: string;
}

export const RATING_TIERS: RatingTier[] = [
  { id: "artifact", label: "Artifact", min: 3000, colorVar: "tier-artifact", hex: "#e6cc80" },
  { id: "legendary", label: "Legendary", min: 2560, colorVar: "tier-legendary", hex: "#ff8000" },
  { id: "epic", label: "Epic", min: 2080, colorVar: "tier-epic", hex: "#a335ee" },
  { id: "rare", label: "Rare", min: 1600, colorVar: "tier-rare", hex: "#0070dd" },
  { id: "uncommon", label: "Uncommon", min: 0, colorVar: "tier-uncommon", hex: "#1eff00" },
];

export function ratingTier(rating: number): RatingTier {
  return RATING_TIERS.find((t) => rating >= t.min) ?? RATING_TIERS[RATING_TIERS.length - 1];
}

// Generic over the run shape (rather than importing DungeonBestRun from the
// data layer, which this config-only game module has no business depending
// on) — the single highest-SCORE run this season, any dungeon. Not
// necessarily the highest level: a well-timed lower key can outscore a
// barely-timed higher one.
export function bestOverallRun<T extends { score: number }>(runs: T[]): T | null {
  return runs.reduce<T | null>((best, r) => (!best || r.score > best.score ? r : best), null);
}
