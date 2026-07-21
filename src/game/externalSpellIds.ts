// Spell IDs for "external" defensives the applicant can RECEIVE from allies —
// the buff that lands on them (AMZ, Pain Suppression, Sac, Barrier...). Any of
// these can appear on any class, so this is one flat list (not per-class): its
// presence on the applicant's Buffs table means a teammate used it on them.
//
// Companion to the descriptive rosters defensives.ts / externalDefensives.ts
// (which carry names/icons/providerSpecs but no spellIds). Beta coverage of the
// common ones; spellIds are the received-buff ids, which for a few (AMZ,
// Barrier) differ from the cast id.

export interface ExternalSpellDef {
  spellId: number;
  name: string;
}

export const EXTERNAL_DEFENSIVE_SPELLS: ExternalSpellDef[] = [
  { spellId: 33206, name: "Pain Suppression" },
  { spellId: 47788, name: "Guardian Spirit" },
  { spellId: 102342, name: "Ironbark" },
  { spellId: 116849, name: "Life Cocoon" },
  { spellId: 357170, name: "Time Dilation" },
  { spellId: 6940, name: "Blessing of Sacrifice" },
  { spellId: 1022, name: "Blessing of Protection" },
  { spellId: 204018, name: "Blessing of Spellwarding" },
  { spellId: 53480, name: "Roar of Sacrifice" },
  { spellId: 145629, name: "Anti-Magic Zone" },
  { spellId: 97463, name: "Rallying Cry" },
  { spellId: 81782, name: "Power Word: Barrier" },
];
