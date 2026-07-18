// Enemy repositioning ("grips") — pulling a hostile target toward you or a
// point, rather than helping an ally. Distinct from movement.ts / dispels.ts,
// which are things you do *for* the party.

export interface EnemyRepositioningDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string; // tooltip text
  requiresTalent?: boolean; // player must have selected this talent — not guaranteed just by spec
  providerSpecs: string[];
}

export const ENEMY_REPOSITIONING: EnemyRepositioningDef[] = [
  { id: "deathgrip", name: "Death Grip", short: "Death Grip", icon: "spell_deathknight_strangulate", description: "Blood/Frost/Unholy Death Knight. Pulls one enemy to the Death Knight and can interrupt casts through displacement. Baseline.", providerSpecs: ["deathknight:blood", "deathknight:frost", "deathknight:unholy"] },
  { id: "gorefiendsgrasp", name: "Gorefiend's Grasp", short: "Gorefiend's Grasp", icon: "ability_deathknight_aoedeathgrip", description: "Blood Death Knight. Pulls surrounding enemies to the selected target's location.", requiresTalent: true, providerSpecs: ["deathknight:blood"] },
];

export const ENEMY_REPOSITIONING_BY_ID: Record<string, EnemyRepositioningDef> = Object.fromEntries(
  ENEMY_REPOSITIONING.map((d) => [d.id, d])
);
