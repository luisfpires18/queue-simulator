// Optional raid buffs/debuffs. Each has its own spell icon (not the class crest).
import type { ClassId } from "./classes";

export interface BuffDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  kind: "buff" | "debuff";
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerClasses: ClassId[];
}

export const BUFFS: BuffDef[] = [
  { id: "chaosbrand", name: "Chaos Brand", short: "Chaos Brand", icon: "ability_demonhunter_empowerwards", description: "Havoc/Vengeance/Devourer Demon Hunter. Enemies damaged take 3% increased magic damage.", kind: "debuff", providerClasses: ["demonhunter"] },
  { id: "mystictouch", name: "Mystic Touch", short: "Mystic Touch", icon: "ability_monk_sparring", description: "Brewmaster/Mistweaver/Windwalker Monk. Enemies damaged take 5% increased Physical damage.", kind: "debuff", providerClasses: ["monk"] },
  { id: "motw", name: "Mark of the Wild", short: "MotW", icon: "spell_nature_regeneration", description: "Balance/Feral/Guardian/Restoration Druid. Increases party Versatility by 3%.", kind: "buff", providerClasses: ["druid"] },
  { id: "arcaneint", name: "Arcane Intellect", short: "Arc Int", icon: "spell_holy_magicalsentry", description: "Arcane/Fire/Frost Mage. Increases party Intellect by 3%.", kind: "buff", providerClasses: ["mage"] },
  { id: "fortitude", name: "Power Word: Fortitude", short: "Fort", icon: "spell_holy_wordfortitude", description: "Discipline/Holy/Shadow Priest. Increases party Stamina by 5%.", kind: "buff", providerClasses: ["priest"] },
  { id: "battleshout", name: "Battle Shout", short: "Shout", icon: "ability_warrior_battleshout", description: "Arms/Fury/Protection Warrior. Increases party Attack Power by 5%.", kind: "buff", providerClasses: ["warrior"] },
  { id: "skyfury", name: "Skyfury", short: "Skyfury", icon: "achievement_raidprimalist_windelemental", description: "Elemental/Enhancement/Restoration Shaman. Grants 2% Mastery and gives auto-attacks a 20% chance to strike again.", kind: "buff", providerClasses: ["shaman"] },
  { id: "bronze", name: "Blessing of the Bronze", short: "Bronze", icon: "ability_evoker_blessingofthebronze", description: "All Evokers. Raid-wide movement and utility buff.", kind: "buff", providerClasses: ["evoker"] },
  { id: "huntersmark", name: "Hunter's Mark", short: "Hunter's Mark", icon: "ability_hunter_markedfordeath", description: "Beast Mastery/Marksmanship/Survival Hunter. One marked enemy takes 3% increased damage.", kind: "debuff", providerClasses: ["hunter"] },
  { id: "atrophicpoison", name: "Atrophic Poison", short: "Atrophic Poison", icon: "ability_rogue_nervesofsteel", description: "Assassination/Outlaw/Subtlety Rogue, when talented. Poisoned enemies deal 3% less damage.", kind: "debuff", requiresTalent: true, providerClasses: ["rogue"] },
  { id: "draconicattunements", name: "Draconic Attunements", short: "Draconic Attune", icon: "ability_evoker_draconicattunements", description: "Augmentation Evoker. Black grants 2% maximum health; Bronze grants 10% movement speed to the Evoker and four nearby allies.", kind: "buff", providerClasses: ["evoker"] },
  { id: "devotionaura", name: "Devotion Aura", short: "Devotion Aura", icon: "spell_holy_devotionaura", description: "Holy/Protection/Retribution Paladin. Party members within range take 3% less damage.", kind: "buff", providerClasses: ["paladin"] },
];

export const BUFF_BY_ID: Record<string, BuffDef> = Object.fromEntries(BUFFS.map((b) => [b.id, b]));
