// Raid-wide party defensive cooldowns. Unlike buffs.ts these are usually
// locked to a single spec (not the whole class), so providers are exact
// specIds (`${classId}:${specSlug}`) rather than ClassIds.

export interface DefensiveDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerSpecs: string[];
}

export const DEFENSIVES: DefensiveDef[] = [
  { id: "amz", name: "Anti-Magic Zone", short: "AMZ", icon: "spell_deathknight_antimagiczone", description: "Blood/Frost/Unholy Death Knight. Party members inside take 15% less magic damage for 6 seconds.", providerSpecs: ["deathknight:blood", "deathknight:frost", "deathknight:unholy"] },
  { id: "darkness", name: "Darkness", short: "Darkness", icon: "ability_demonhunter_darkness", description: "Havoc/Vengeance/Devourer Demon Hunter. Allies inside have a 15% chance to avoid damage, increased to 30% outside raids.", providerSpecs: ["demonhunter:havoc", "demonhunter:vengeance", "demonhunter:devourer"] },
  { id: "zephyr", name: "Zephyr", short: "Zephyr", icon: "ability_evoker_hoverblack", description: "Augmentation/Devastation/Preservation Evoker. The Evoker and four nearby allies take 20% less AoE damage and gain 30% movement speed for 8 seconds.", providerSpecs: ["evoker:augmentation", "evoker:devastation", "evoker:preservation"] },
  { id: "rallyingcry", name: "Rallying Cry", short: "Rallying Cry", icon: "ability_warrior_rallyingcry", description: "Arms/Fury/Protection Warrior. Grants temporary and maximum health for 10 seconds, with a stronger effect outside raids.", providerSpecs: ["warrior:arms", "warrior:fury", "warrior:protection"] },
  { id: "auramastery", name: "Aura Mastery", short: "Aura Mastery", icon: "spell_holy_auramastery", description: "Holy Paladin. Empowers Devotion Aura to provide 12% party damage reduction for 8 seconds.", providerSpecs: ["paladin:holy"] },
  { id: "pwbarrier", name: "Power Word: Barrier", short: "PW: Barrier", icon: "spell_holy_powerwordbarrier", description: "Discipline Priest. Allies inside take 20% less damage for 10 seconds.", providerSpecs: ["priest:discipline"] },
  { id: "spiritlink", name: "Spirit Link Totem", short: "Spirit Link", icon: "spell_shaman_spiritlink", description: "Restoration Shaman. Provides 10% damage reduction and repeatedly redistributes health between allies inside.", providerSpecs: ["shaman:restoration"] },
  { id: "revival", name: "Revival", short: "Revival", icon: "spell_monk_revival", description: "Mistweaver Monk. Instantly heals the party and removes up to three Magic effects plus all Poison and Disease effects.", requiresTalent: true, providerSpecs: ["monk:mistweaver"] },
  { id: "rewind", name: "Rewind", short: "Rewind", icon: "ability_evoker_rewind", description: "Preservation Evoker. Restores a percentage of damage taken by the entire party during the previous 5 seconds.", providerSpecs: ["evoker:preservation"] },
];

export const DEFENSIVE_BY_ID: Record<string, DefensiveDef> = Object.fromEntries(
  DEFENSIVES.map((d) => [d.id, d])
);
