// Comp archetype ruleset. Weighted "signature" specs per archetype.
// A group's archetype = the archetype whose signature specs it best matches.
// Edit these arrays when the meta shifts — logic in analyze.ts stays put.

export interface CompArchetype {
  id: string;
  label: string;
  blurb: string;
  // signature spec ids and how strongly each signals this archetype
  signature: { specId: string; weight: number }[];
}

export const ARCHETYPES: CompArchetype[] = [
  {
    id: "meta",
    label: "Meta",
    blurb: "Current Midnight S1 title-push comp: bear / mistweaver / DH / DK / aug.",
    signature: [
      { specId: "druid:guardian", weight: 3 },
      { specId: "monk:mistweaver", weight: 2 },
      { specId: "demonhunter:devourer", weight: 3 },
      { specId: "deathknight:unholy", weight: 3 },
      { specId: "evoker:augmentation", weight: 3 },
    ],
  },
  {
    id: "physical",
    label: "Physical",
    blurb: "Physical-cleave core - warrior + enhance + monk, armor-shred synergy.",
    signature: [
      { specId: "warrior:arms", weight: 2 },
      { specId: "warrior:fury", weight: 2 },
      { specId: "warrior:protection", weight: 2 },
      { specId: "shaman:enhancement", weight: 2 },
      { specId: "monk:windwalker", weight: 2 },
      { specId: "monk:brewmaster", weight: 1 },
      { specId: "rogue:assassination", weight: 2 },
      { specId: "hunter:survival", weight: 1 },
      { specId: "deathknight:frost", weight: 1 },
    ],
  },
];

export const OFF_META = { id: "offmeta", label: "Off-meta", blurb: "A flexible / custom comp." };
