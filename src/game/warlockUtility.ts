// Warlock-specific party utility.

export interface WarlockUtilityDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerSpecs: string[];
}

export const WARLOCK_UTILITY: WarlockUtilityDef[] = [
  { id: "healthstone", name: "Create Soulwell / Healthstone", short: "Healthstone", icon: "warlock_-healthstone", description: "Affliction/Demonology/Destruction Warlock. Gives the party Healthstones that restore 25% maximum health. Baseline.", providerSpecs: ["warlock:affliction", "warlock:demonology", "warlock:destruction"] },
  { id: "demonicgateway", name: "Demonic Gateway", short: "Demonic Gateway", icon: "spell_warlock_demonicportal_green", description: "Affliction/Demonology/Destruction Warlock. Creates a gateway that party members can use to teleport up to 40 yards.", requiresTalent: true, providerSpecs: ["warlock:affliction", "warlock:demonology", "warlock:destruction"] },
];

export const WARLOCK_UTILITY_BY_ID: Record<string, WarlockUtilityDef> = Object.fromEntries(
  WARLOCK_UTILITY.map((d) => [d.id, d])
);
