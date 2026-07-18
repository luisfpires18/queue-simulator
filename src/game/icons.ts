// Real WoW icon slugs -> Wowhead's zamimg CDN (same source raider.io uses).
// Any missing/typo'd slug degrades gracefully to a CSS glyph (see WowIcon).

export type IconSize = "small" | "medium" | "large";

export function iconUrl(slug: string, size: IconSize = "large"): string {
  return `https://wow.zamimg.com/images/wow/icons/${size}/${slug}.jpg`;
}

// specId (`${classId}:${slug}`) -> canonical Wowhead spec icon file
export const SPEC_ICON: Record<string, string> = {
  "warrior:arms": "ability_warrior_savageblow",
  "warrior:fury": "ability_warrior_innerrage",
  "warrior:protection": "ability_warrior_defensivestance",

  "paladin:holy": "spell_holy_holybolt",
  "paladin:protection": "ability_paladin_shieldofthetemplar",
  "paladin:retribution": "spell_holy_auraoflight",

  "hunter:beastmastery": "ability_hunter_bestialdiscipline",
  "hunter:marksmanship": "ability_hunter_focusedaim",
  "hunter:survival": "ability_hunter_camouflage",

  "rogue:assassination": "ability_rogue_deadlybrew",
  "rogue:outlaw": "ability_rogue_waylay",
  "rogue:subtlety": "ability_stealth",

  "priest:discipline": "spell_holy_powerwordshield",
  "priest:holy": "spell_holy_guardianspirit",
  "priest:shadow": "spell_shadow_shadowwordpain",

  "shaman:elemental": "spell_nature_lightning",
  "shaman:enhancement": "spell_shaman_improvedstormstrike",
  "shaman:restoration": "spell_nature_magicimmunity",

  "mage:arcane": "spell_holy_magicalsentry",
  "mage:fire": "spell_fire_firebolt02",
  "mage:frost": "spell_frost_frostbolt02",

  "warlock:affliction": "spell_shadow_deathcoil",
  "warlock:demonology": "spell_shadow_metamorphosis",
  "warlock:destruction": "spell_shadow_rainoffire",

  "monk:brewmaster": "spell_monk_brewmaster_spec",
  "monk:mistweaver": "spell_monk_mistweaver_spec",
  "monk:windwalker": "spell_monk_windwalker_spec",

  "druid:balance": "spell_nature_starfall",
  "druid:feral": "ability_druid_catform",
  "druid:guardian": "ability_racial_bearform",
  "druid:restoration": "spell_nature_healingtouch",

  "demonhunter:havoc": "ability_demonhunter_specdps",
  "demonhunter:devourer": "classicon_demonhunter_void",
  "demonhunter:vengeance": "ability_demonhunter_spectank",

  "deathknight:blood": "spell_deathknight_bloodpresence",
  "deathknight:frost": "spell_deathknight_frostpresence",
  "deathknight:unholy": "spell_deathknight_unholypresence",

  "evoker:augmentation": "classicon_evoker_augmentation",
  "evoker:devastation": "classicon_evoker_devastation",
  "evoker:preservation": "classicon_evoker_preservation",
};

// Utility / mandatory-effect spell icons
export const SPELL_ICON = {
  lust: "spell_nature_bloodlust", // Bloodlust / Heroism / Time Warp family
  combatRes: "spell_nature_reincarnation", // Rebirth / battle-res family
} as const;

// Class crest icons (classicon_<class>)
import type { ClassId } from "./classes";
export const CLASS_ICON: Record<ClassId, string> = {
  warrior: "classicon_warrior",
  paladin: "classicon_paladin",
  hunter: "classicon_hunter",
  rogue: "classicon_rogue",
  priest: "classicon_priest",
  shaman: "classicon_shaman",
  mage: "classicon_mage",
  warlock: "classicon_warlock",
  monk: "classicon_monk",
  druid: "classicon_druid",
  demonhunter: "classicon_demonhunter",
  deathknight: "classicon_deathknight",
  evoker: "classicon_evoker",
};

// Misc
export const MISC_ICON = {
  keystone: "inv_relics_hourglass",
  roster: "inv_misc_groupneedmore",
  parse: "inv_misc_spyglass_03",
  bell: "inv_misc_bell_01",
  identity: "inv_misc_note_01",
  clock: "inv_misc_pocketwatch_01",
  settings: "inv_misc_gear_01",
} as const;

export function specIconUrl(specId: string, size: IconSize = "large"): string | null {
  const slug = SPEC_ICON[specId];
  return slug ? iconUrl(slug, size) : null;
}

// String-safe class crest lookup for DB values.
export function classIconSlug(classId: string): string | undefined {
  return CLASS_ICON[classId as ClassId];
}
