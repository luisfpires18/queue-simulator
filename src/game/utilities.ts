// Combat-utility coverage: which classes provide the near-mandatory M+ effects
// (Lust, Battle Res) plus common external/party utility — dispels live in
// dispels.ts (spec-precise, since e.g. Mistweaver's Detox differs from
// Brewmaster/Windwalker's); this file is class-wide utility only.
// Config-only — editing these sets changes analyzer output without touching logic.

import type { ClassId } from "./classes";

export interface UtilityDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  // classes that provide it, with the ability name for the tooltip
  providers: Partial<Record<ClassId, string>>;
  mandatory: boolean; // treated as required for a "complete" group
}

export const BLOODLUST: UtilityDef = {
  id: "lust",
  name: "Bloodlust / Heroism",
  short: "Lust",
  icon: "spell_nature_bloodlust",
  description: "Elemental/Enhancement/Restoration Shaman, Arcane/Fire/Frost Mage, all Evokers, all Hunters with a Ferocity pet. Increases party Haste by 30% for 40 seconds.",
  mandatory: true,
  providers: {
    shaman: "Bloodlust / Heroism",
    mage: "Time Warp",
    hunter: "Primal Rage (pet)",
    evoker: "Fury of the Aspects",
  },
};

export const COMBAT_RES: UtilityDef = {
  id: "combatRes",
  name: "Combat Resurrection",
  short: "Battle Res",
  icon: "spell_nature_reincarnation",
  description: "Blood/Frost/Unholy Death Knight, all Druids, all Paladins, all Warlocks. Resurrects an ally during combat.",
  mandatory: true,
  providers: {
    druid: "Rebirth",
    deathknight: "Raise Ally",
    warlock: "Soulstone",
    paladin: "Intercession",
  },
};

export const POWER_INFUSION: UtilityDef = {
  id: "powerinfusion",
  name: "Power Infusion",
  short: "Power Infusion",
  icon: "spell_holy_powerinfusion",
  description: "Discipline/Holy/Shadow Priest. Grants an ally 20% Haste for 15 seconds. It is available to all three Priest specs.",
  mandatory: false,
  providers: { priest: "Power Infusion" },
};

export const INNERVATE: UtilityDef = {
  id: "innervate",
  name: "Innervate",
  short: "Innervate",
  icon: "spell_nature_lightning",
  description: "Balance/Feral/Guardian/Restoration Druid. Allows a friendly healer to cast without spending Mana for 8 seconds.",
  mandatory: false,
  providers: { druid: "Innervate" },
};

export const BLESSING_OF_FREEDOM: UtilityDef = {
  id: "blessingfreedom",
  name: "Blessing of Freedom",
  short: "Bless: Freedom",
  icon: "spell_holy_sealofvalor",
  description: "Holy/Protection/Retribution Paladin. Removes and prevents movement-impairing effects for 8 seconds.",
  mandatory: false,
  providers: { paladin: "Blessing of Freedom" },
};

export const TIGERS_LUST: UtilityDef = {
  id: "tigerslust",
  name: "Tiger's Lust",
  short: "Tiger's Lust",
  icon: "ability_monk_tigerslust",
  description: "Monk (row-1 class talent — automatic for Brewmaster). Instantly clears the target of all immobilizing and movement-impairing effects, and increases their movement speed by 70% for 6 seconds.",
  requiresTalent: true,
  mandatory: false,
  providers: { monk: "Tiger's Lust" },
};

export const RESCUE: UtilityDef = {
  id: "rescue",
  name: "Rescue",
  short: "Rescue",
  icon: "ability_evoker_flywithme",
  description: "Augmentation/Devastation/Preservation Evoker. Picks up an ally and carries them to a selected location.",
  mandatory: false,
  providers: { evoker: "Rescue" },
};

export const LEAP_OF_FAITH: UtilityDef = {
  id: "leapoffaith",
  name: "Leap of Faith",
  short: "Leap of Faith",
  icon: "priest_spell_leapoffaith_a",
  description: "Discipline/Holy/Shadow Priest. Pulls an ally directly to the Priest.",
  mandatory: false,
  providers: { priest: "Leap of Faith" },
};

export const SHROUD_OF_CONCEALMENT: UtilityDef = {
  id: "shroudofconcealment",
  name: "Shroud of Concealment",
  short: "Shroud",
  icon: "ability_rogue_shroudofconcealment",
  description: "All Rogue specs. Grants party stealth for planned skips.",
  mandatory: false,
  providers: { rogue: "Shroud of Concealment" },
};

export const TREMOR_TOTEM: UtilityDef = {
  id: "tremortotem",
  name: "Tremor Totem",
  short: "Tremor Totem",
  icon: "spell_nature_tremortotem",
  description: "All Shaman specs. Talent. Removes Fear, Charm and Sleep effects.",
  requiresTalent: true,
  mandatory: false,
  providers: { shaman: "Tremor Totem" },
};

export const BERSERKER_SHOUT: UtilityDef = {
  id: "berserkershout",
  name: "Berserker Shout",
  short: "Berserker Shout",
  icon: "spell_nature_ancestralguardian",
  description: "Arms/Fury/Protection Warrior. Talent. Breaks Fear effects on nearby allies.",
  requiresTalent: true,
  mandatory: false,
  providers: { warrior: "Berserker Shout" },
};

export const MASTERS_CALL: UtilityDef = {
  id: "masterscall",
  name: "Master's Call",
  short: "Master's Call",
  icon: "ability_hunter_invigeration",
  description: "All Hunter specs with a Cunning pet. Removes roots and snares from an ally.",
  mandatory: false,
  providers: { hunter: "Master's Call" },
};

export const MIND_SOOTHE: UtilityDef = {
  id: "mindsoothe",
  name: "Mind Soothe",
  short: "Mind Soothe",
  icon: "spell_holy_mindsooth",
  description: "Discipline/Holy/Shadow Priest. Reduces enemy detection range for planned skips.",
  mandatory: false,
  providers: { priest: "Mind Soothe" },
};

export const RING_OF_PEACE: UtilityDef = {
  id: "ringofpeace",
  name: "Ring of Peace",
  short: "Ring of Peace",
  icon: "spell_monk_ringofpeace",
  description: "Brewmaster/Mistweaver/Windwalker Monk. Talent. Pushes enemies away and prevents them entering its area.",
  requiresTalent: true,
  mandatory: false,
  providers: { monk: "Ring of Peace" },
};

export const SOURCE_OF_MAGIC: UtilityDef = {
  id: "sourceofmagic",
  name: "Source of Magic",
  short: "Source of Magic",
  icon: "ability_evoker_blue_01",
  description: "Augmentation/Devastation/Preservation Evoker. Talent. Provides mana support to a friendly healer.",
  requiresTalent: true,
  mandatory: false,
  providers: { evoker: "Source of Magic" },
};

export const UTILITIES: UtilityDef[] = [
  BLOODLUST,
  COMBAT_RES,
  POWER_INFUSION,
  INNERVATE,
  BLESSING_OF_FREEDOM,
  TIGERS_LUST,
  RESCUE,
  LEAP_OF_FAITH,
  SHROUD_OF_CONCEALMENT,
  TREMOR_TOTEM,
  BERSERKER_SHOUT,
  MASTERS_CALL,
  MIND_SOOTHE,
  RING_OF_PEACE,
  SOURCE_OF_MAGIC,
];

export function classProvides(util: UtilityDef, classId: ClassId): boolean {
  return classId in util.providers;
}
