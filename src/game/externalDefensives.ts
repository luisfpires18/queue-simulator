// Single-target ("external") defensive cooldowns a healer/support can cast on
// someone else. Same spec-locked shape as defensives.ts (party-wide ones).

export interface ExternalDefensiveDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerSpecs: string[];
}

export const EXTERNAL_DEFENSIVES: ExternalDefensiveDef[] = [
  { id: "painsuppression", name: "Pain Suppression", short: "Pain Sup", icon: "spell_holy_painsupression", description: "Discipline Priest. Reduces one ally's damage taken by 40% for 8 seconds.", providerSpecs: ["priest:discipline"] },
  { id: "guardianspirit", name: "Guardian Spirit", short: "Guardian Spirit", icon: "spell_holy_guardianspirit", description: "Holy Priest. Increases healing received by 60% and prevents one killing blow.", providerSpecs: ["priest:holy"] },
  { id: "ironbark", name: "Ironbark", short: "Ironbark", icon: "spell_druid_ironbark", description: "Restoration Druid. Reduces one ally's damage taken by 20% for 12 seconds.", providerSpecs: ["druid:restoration"] },
  { id: "lifecocoon", name: "Life Cocoon", short: "Life Cocoon", icon: "ability_monk_chicocoon", description: "Mistweaver Monk. Places a large absorb on an ally and increases healing-over-time received by 50%.", providerSpecs: ["monk:mistweaver"] },
  { id: "timedilation", name: "Time Dilation", short: "Time Dilation", icon: "ability_evoker_timedilation", description: "Preservation Evoker. Delays 50% of an ally's incoming damage, dealing it over 8 seconds instead.", providerSpecs: ["evoker:preservation"] },
  { id: "blessingsacrifice", name: "Blessing of Sacrifice", short: "Bless: Sacrifice", icon: "spell_holy_sealofsacrifice", description: "Holy/Protection/Retribution Paladin. Reduces an ally's damage taken by 30%, transferring the prevented damage to the Paladin.", providerSpecs: ["paladin:holy", "paladin:protection", "paladin:retribution"] },
  { id: "blessingprotection", name: "Blessing of Protection", short: "Bless: Prot", icon: "spell_holy_sealofprotection", description: "Holy/Protection/Retribution Paladin. Grants immunity to Physical damage and harmful Physical effects for 10 seconds.", providerSpecs: ["paladin:holy", "paladin:protection", "paladin:retribution"] },
  { id: "blessingspellwarding", name: "Blessing of Spellwarding", short: "Bless: Spellward", icon: "spell_holy_blessingofprotection", description: "Protection Paladin, when talented. Grants immunity to magical damage and harmful magical effects.", requiresTalent: true, providerSpecs: ["paladin:protection"] },
  { id: "roarofsacrifice", name: "Roar of Sacrifice", short: "Roar of Sacrifice", icon: "ability_hunter_fervor", description: "Beast Mastery/Marksmanship/Survival Hunter. Talent and active pet required.", requiresTalent: true, providerSpecs: ["hunter:beastmastery", "hunter:marksmanship", "hunter:survival"] },
];

export const EXTERNAL_DEFENSIVE_BY_ID: Record<string, ExternalDefensiveDef> = Object.fromEntries(
  EXTERNAL_DEFENSIVES.map((d) => [d.id, d])
);
