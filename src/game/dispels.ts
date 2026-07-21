// Friendly dispels — which Magic/Curse/Poison/Disease/Bleed effects a spec
// can remove from an ally. Several classes have two variants of the same
// spell name (a healing spec's baseline vs. a DPS/tank spec's talented
// version, e.g. Monk's Detox), so these are modeled per exact effect rather
// than one row per spell name.

export interface DispelDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text, includes what it removes
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerSpecs: string[];
}

export const DISPELS: DispelDef[] = [
  // Evoker
  { id: "cauterizingflame", name: "Cauterizing Flame", short: "Cauterizing Flame", icon: "ability_evoker_fontofmagic_red", description: "Augmentation/Devastation/Preservation Evoker. Removes Bleed, Poison, Curse and Disease effects, and heals if it removes something.", requiresTalent: true, providerSpecs: ["evoker:augmentation", "evoker:devastation", "evoker:preservation"] },
  { id: "expunge", name: "Expunge", short: "Expunge", icon: "ability_evoker_fontofmagic_green", description: "Augmentation/Devastation Evoker. Removes Poison.", requiresTalent: true, providerSpecs: ["evoker:augmentation", "evoker:devastation"] },
  { id: "naturalize", name: "Naturalize", short: "Naturalize", icon: "ability_evoker_fontofmagic_green", description: "Preservation Evoker. Removes Magic and Poison.", providerSpecs: ["evoker:preservation"] },
  // Druid
  { id: "removecorruption", name: "Remove Corruption", short: "Remove Corruption", icon: "spell_holy_removecurse", description: "Balance/Feral/Guardian Druid. Removes Curse and Poison.", requiresTalent: true, providerSpecs: ["druid:balance", "druid:feral", "druid:guardian"] },
  { id: "naturescure", name: "Nature's Cure", short: "Nature's Cure", icon: "ability_shaman_cleansespirit", description: "Restoration Druid. Removes Magic.", providerSpecs: ["druid:restoration"] },
  { id: "improvednaturescure", name: "Improved Nature's Cure", short: "Imp. Nature's Cure", icon: "ability_shaman_cleansespirit", description: "Restoration Druid. Nature's Cure additionally removes Curse and Poison.", requiresTalent: true, providerSpecs: ["druid:restoration"] },
  // Mage
  { id: "removecurse", name: "Remove Curse", short: "Remove Curse", icon: "spell_nature_removecurse", description: "Arcane/Fire/Frost Mage. Removes Curse.", requiresTalent: true, providerSpecs: ["mage:arcane", "mage:fire", "mage:frost"] },
  // Monk
  { id: "detoxdps", name: "Detox", short: "Detox", icon: "ability_rogue_imrovedrecuperate", description: "Brewmaster/Windwalker Monk. Removes Poison and Disease.", requiresTalent: true, providerSpecs: ["monk:brewmaster", "monk:windwalker"] },
  { id: "detoxmw", name: "Detox", short: "Detox", icon: "ability_rogue_imrovedrecuperate", description: "Mistweaver Monk. Removes Magic.", providerSpecs: ["monk:mistweaver"] },
  { id: "improveddetox", name: "Improved Detox", short: "Imp. Detox", icon: "ability_rogue_imrovedrecuperate", description: "Mistweaver Monk. Detox additionally removes Poison and Disease.", requiresTalent: true, providerSpecs: ["monk:mistweaver"] },
  // Paladin
  { id: "cleansetoxins", name: "Cleanse Toxins", short: "Cleanse Toxins", icon: "spell_holy_renew", description: "Protection/Retribution Paladin. Removes Poison and Disease.", requiresTalent: true, providerSpecs: ["paladin:protection", "paladin:retribution"] },
  { id: "cleanse", name: "Cleanse", short: "Cleanse", icon: "spell_holy_purify", description: "Holy Paladin. Removes Magic.", providerSpecs: ["paladin:holy"] },
  { id: "improvedcleanse", name: "Improved Cleanse", short: "Imp. Cleanse", icon: "spell_holy_purify", description: "Holy Paladin. Cleanse additionally removes Poison and Disease.", requiresTalent: true, providerSpecs: ["paladin:holy"] },
  // Priest
  { id: "purify", name: "Purify", short: "Purify", icon: "spell_holy_dispelmagic", description: "Discipline/Holy Priest. Removes Magic and Disease.", providerSpecs: ["priest:discipline", "priest:holy"] },
  { id: "purifydisease", name: "Purify Disease", short: "Purify Disease", icon: "spell_holy_nullifydisease", description: "Shadow Priest. Removes Disease.", requiresTalent: true, providerSpecs: ["priest:shadow"] },
  { id: "massdispel", name: "Mass Dispel", short: "Mass Dispel", icon: "spell_arcane_massdispel", description: "Discipline/Holy/Shadow Priest. Removes harmful Magic effects from up to five allies and beneficial Magic effects from enemies.", requiresTalent: true, providerSpecs: ["priest:discipline", "priest:holy", "priest:shadow"] },
  // Shaman
  { id: "cleansespirit", name: "Cleanse Spirit", short: "Cleanse Spirit", icon: "ability_shaman_cleansespirit", description: "Elemental/Enhancement Shaman. Removes Curse.", requiresTalent: true, providerSpecs: ["shaman:elemental", "shaman:enhancement"] },
  { id: "purifyspirit", name: "Purify Spirit", short: "Purify Spirit", icon: "ability_shaman_cleansespirit", description: "Restoration Shaman. Removes Magic.", providerSpecs: ["shaman:restoration"] },
  { id: "improvedpurifyspirit", name: "Improved Purify Spirit", short: "Imp. Purify Spirit", icon: "ability_shaman_cleansespirit", description: "Restoration Shaman. Purify Spirit additionally removes Curse.", requiresTalent: true, providerSpecs: ["shaman:restoration"] },
  { id: "poisoncleansingtotem", name: "Poison Cleansing Totem", short: "Poison Cleanse Totem", icon: "spell_nature_poisoncleansingtotem", description: "Elemental/Enhancement/Restoration Shaman. Repeatedly removes Poison from nearby party members for six seconds.", requiresTalent: true, providerSpecs: ["shaman:elemental", "shaman:enhancement", "shaman:restoration"] },
];

export const DISPEL_BY_ID: Record<string, DispelDef> = Object.fromEntries(
  DISPELS.map((d) => [d.id, d])
);

// Every spec that can friendly-dispel SOMETHING (any of the rows above lists it
// as a provider). Used to hide the dispel metric entirely for classes that have
// no dispel at all (Death Knight, Demon Hunter, Warrior, Rogue) rather than
// reporting a misleading "0".
const DISPEL_CAPABLE_SPECS = new Set<string>(DISPELS.flatMap((d) => d.providerSpecs));

export function canDispel(specId: string | null | undefined): boolean {
  return specId != null && DISPEL_CAPABLE_SPECS.has(specId);
}
