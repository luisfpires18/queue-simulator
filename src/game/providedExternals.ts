// External / party defensive cooldowns the applicant PROVIDES to the group by
// casting them (AMZ from a DK, Rallying Cry from a Warrior, Pain Suppression
// from a Disc priest...). Counted from the applicant's own Casts table, keyed by
// the CAST spellId (which for a few differs from the received-buff id in
// externalSpellIds.ts). providerSpecs mirror defensives.ts / externalDefensives.ts
// so only cooldowns the applicant's spec can actually bring are looked for.

export interface ProvidedExternalDef {
  spellId: number;
  name: string;
  providerSpecs: string[];
}

export const PROVIDED_EXTERNALS: ProvidedExternalDef[] = [
  // Party-wide (defensives.ts)
  { spellId: 51052, name: "Anti-Magic Zone", providerSpecs: ["deathknight:blood", "deathknight:frost", "deathknight:unholy"] },
  { spellId: 196718, name: "Darkness", providerSpecs: ["demonhunter:havoc", "demonhunter:vengeance", "demonhunter:devourer"] },
  { spellId: 374227, name: "Zephyr", providerSpecs: ["evoker:augmentation", "evoker:devastation", "evoker:preservation"] },
  { spellId: 97462, name: "Rallying Cry", providerSpecs: ["warrior:arms", "warrior:fury", "warrior:protection"] },
  { spellId: 31821, name: "Aura Mastery", providerSpecs: ["paladin:holy"] },
  { spellId: 62618, name: "Power Word: Barrier", providerSpecs: ["priest:discipline"] },
  { spellId: 98008, name: "Spirit Link Totem", providerSpecs: ["shaman:restoration"] },
  { spellId: 115310, name: "Revival", providerSpecs: ["monk:mistweaver"] },
  { spellId: 363534, name: "Rewind", providerSpecs: ["evoker:preservation"] },
  // Single-target externals (externalDefensives.ts)
  { spellId: 33206, name: "Pain Suppression", providerSpecs: ["priest:discipline"] },
  { spellId: 47788, name: "Guardian Spirit", providerSpecs: ["priest:holy"] },
  { spellId: 102342, name: "Ironbark", providerSpecs: ["druid:restoration"] },
  { spellId: 116849, name: "Life Cocoon", providerSpecs: ["monk:mistweaver"] },
  { spellId: 357170, name: "Time Dilation", providerSpecs: ["evoker:preservation"] },
  { spellId: 6940, name: "Blessing of Sacrifice", providerSpecs: ["paladin:holy", "paladin:protection", "paladin:retribution"] },
  { spellId: 1022, name: "Blessing of Protection", providerSpecs: ["paladin:holy", "paladin:protection", "paladin:retribution"] },
  { spellId: 204018, name: "Blessing of Spellwarding", providerSpecs: ["paladin:protection"] },
  { spellId: 53480, name: "Roar of Sacrifice", providerSpecs: ["hunter:beastmastery", "hunter:marksmanship", "hunter:survival"] },
];

/** The externals a given spec can cast, as [{spellId,name}]. */
export function providedExternalsForSpec(specId: string | null | undefined): { spellId: number; name: string }[] {
  if (!specId) return [];
  return PROVIDED_EXTERNALS.filter((d) => d.providerSpecs.includes(specId)).map((d) => ({ spellId: d.spellId, name: d.name }));
}
