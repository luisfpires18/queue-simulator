// Season 1 raid tiers, mirroring season.ts's DungeonDef/DUNGEONS pattern.
// Unlike M+ dungeons there's no Blizzard instance-id table anywhere in this
// codebase to key off (see src/server/wcl/raidZones.js - raid zone/boss data
// there is resolved live from Warcraft Logs, not a static config) - this list
// is hand-maintained per tier, same as DUNGEONS already is. Icons are Wowhead
// "Guild Run"/"Mythic: <boss>" achievement icon slugs, verified live against
// the zamimg CDN (curl -I .../icons/large/<slug>.jpg -> 200) since most
// per-boss NPC/achievement icons for this brand-new tier aren't populated yet
// and resolve to Wowhead's inv_misc_questionmark placeholder instead.

export interface RaidBossDef {
  id: string;
  name: string;
  order: number;
  icon?: string; // Wowhead icon slug, verified live - omit if none is verified
}

export interface RaidDef {
  id: string;
  name: string;
  abbr: string;
  icon?: string;
  // Mythic roster range for this raid - {20,20} (fixed) on every raid except
  // Sporefall, whose Mythic is Blizzard's first "flex Mythic" (15-25, a
  // narrower band than Normal/Heroic's usual 10-30 - best-effort from
  // secondary sources at implementation time, since Sporefall shipped
  // mid-season in a later patch than the other 3 raids; re-verify against a
  // primary source before relying on the exact bounds).
  mythicRange: { min: number; max: number };
  bosses: RaidBossDef[];
}

export const RAIDS: RaidDef[] = [
  {
    id: "dreamrift",
    name: "The Dreamrift",
    abbr: "DR",
    icon: "inv_120_raid_dreamwell_malformedmanifestation",
    mythicRange: { min: 20, max: 20 },
    bosses: [
      { id: "chimaerus", name: "Chimaerus the Undreamt God", order: 1, icon: "inv_120_raid_dreamwell_malformedmanifestation" },
    ],
  },
  {
    id: "voidspire",
    name: "The Voidspire",
    abbr: "VS",
    icon: "inv_achievement_raid_voidspire",
    mythicRange: { min: 20, max: 20 },
    bosses: [
      { id: "imperator-averzian", name: "Imperator Averzian", order: 1, icon: "inv_120_raid_voidspire_hostgeneral" },
      { id: "vorasius", name: "Vorasius", order: 2, icon: "inv_120_raid_voidspire_kaiju" },
      { id: "fallen-king-salhadaar", name: "Fallen-King Salhadaar", order: 3, icon: "inv_120_raid_voidspire_salhadaar" },
      { id: "vaelgor-ezzorak", name: "Vaelgor & Ezzorak", order: 4, icon: "inv_120_raid_voidspire_dragonduo" },
      { id: "lightblinded-vanguard", name: "Lightblinded Vanguard", order: 5, icon: "inv_120_raid_voidspire_paladintrio" },
      { id: "crown-of-the-cosmos", name: "Crown of the Cosmos", order: 6, icon: "inv_120_raid_voidspire_alleria" },
    ],
  },
  {
    id: "quelDanas",
    name: "March on Quel'Danas",
    abbr: "MoQD",
    icon: "inv_achievement_raid_darkwell",
    mythicRange: { min: 20, max: 20 },
    bosses: [
      { id: "beloren", name: "Belo'ren, Child of Al'ar", order: 1, icon: "inv_120_raid_marchonqueldanas_lightvoidphoenix" },
      { id: "lura", name: "Midnight Falls", order: 2, icon: "inv_120_raid_marchonqueldanas_lura" },
    ],
  },
  {
    id: "sporefall",
    name: "Sporefall",
    abbr: "SF",
    icon: "inv_1207_achievement_raid_fungariangiant_fungalgiant",
    mythicRange: { min: 15, max: 25 }, // flex Mythic - see note on RaidDef.mythicRange
    bosses: [
      { id: "rotmire", name: "Rotmire", order: 1, icon: "inv_1207_achievement_raid_fungariangiant_fungalgiant" },
    ],
  },
];

export const RAID_BY_ID: Record<string, RaidDef> = Object.fromEntries(RAIDS.map((r) => [r.id, r]));

export const RAID_BOSS_BY_ID: Record<string, RaidBossDef> = Object.fromEntries(
  RAIDS.flatMap((r) => r.bosses.map((b) => [b.id, b]))
);

// Premade-group listing difficulties only - LFR is solo-queue content, never
// something you list a roster for or apply to, so it's deliberately excluded
// from the raid-listing board/form (RaidListForm, RaidBoardClient, GroupCard,
// ApplyModal all use this).
export const RAID_DIFFICULTIES = ["normal", "heroic", "mythic"] as const;
export type RaidDifficulty = (typeof RAID_DIFFICULTIES)[number];

export const RAID_DIFFICULTY_LABEL: Record<RaidDifficulty, string> = {
  normal: "Normal",
  heroic: "Heroic",
  mythic: "Mythic",
};

// Kill-tracking difficulties - a superset of the above, since LFR kills are
// real and worth showing on a character's raid-boss grid even though LFR
// itself is never listed/applied to. Highest first: this is also the order
// the sync route checks in, stopping at the first difficulty with any run.
export const RAID_KILL_DIFFICULTIES = ["mythic", "heroic", "normal", "lfr"] as const;
export type RaidKillDifficulty = (typeof RAID_KILL_DIFFICULTIES)[number];

export const RAID_KILL_DIFFICULTY_LABEL: Record<RaidKillDifficulty, string> = {
  mythic: "Mythic",
  heroic: "Heroic",
  normal: "Normal",
  lfr: "LFR",
};

/** Normal/Heroic are always a 10-30 flex roster. Mythic uses the raid's own
 * mythicRange - fixed at 20/20 on every raid except Sporefall's flex Mythic. */
export function raidSizeRange(raidId: string, difficulty: RaidDifficulty): { min: number; max: number; fixed: boolean } {
  if (difficulty === "mythic") {
    const raid = RAID_BY_ID[raidId];
    const { min, max } = raid?.mythicRange ?? { min: 20, max: 20 };
    return { min, max, fixed: min === max };
  }
  return { min: 10, max: 30, fixed: false };
}

/** Mythic-difficulty boss kills vs. the total mythic boss count across every
 * raid in RAIDS - dynamic, not hardcoded to specific raid ids, so a newly
 * added raid tier is automatically included. */
export function raidMythicProgress(raidKills: { raidId: string; bossId: string; difficulty: string }[]): {
  killed: number;
  total: number;
  abbrLabel: string;
} {
  const total = RAIDS.reduce((sum, r) => sum + r.bosses.length, 0);
  const killed = raidKills.filter((k) => k.difficulty === "mythic").length;
  const abbrLabel = RAIDS.map((r) => r.abbr).join(" / ");
  return { killed, total, abbrLabel };
}
