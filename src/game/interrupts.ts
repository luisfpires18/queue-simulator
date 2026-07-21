// Per-spec kick (interrupt) identity, for labelling the WCL Interrupts count on
// the applicant scan. WCL's Interrupts table already counts successful
// interrupts for a sourceID regardless of which ability landed them, so the
// spellId here is display/attribution metadata, not a filter — it names WHICH
// kick the spec brings (user-supplied list, Midnight S1).
//
// Interrupt is class-wide for most classes; four classes split it by spec:
//   Druid    — Skull Bash (Feral/Guardian) vs Solar Beam (Balance)
//   Hunter   — Counter Shot (BM/MM) vs Muzzle (Survival)
//   Warlock  — Spell Lock (Felhunter) vs Axe Toss (Felguard/Demonology)
// (Rest resolve by class; a spec with no dedicated kick — most healers via their
//  class kick — falls back to the class entry.)

export interface InterruptDef {
  spellId: number;
  name: string;
}

// Keyed by specId (`${classId}:${slug}`). Specs sharing one class kick point at
// the same def. Spellids are the long-stable live values.
export const INTERRUPTS: Record<string, InterruptDef> = {
  // Death Knight — Mind Freeze
  "deathknight:blood": { spellId: 47528, name: "Mind Freeze" },
  "deathknight:frost": { spellId: 47528, name: "Mind Freeze" },
  "deathknight:unholy": { spellId: 47528, name: "Mind Freeze" },
  // Demon Hunter — Disrupt
  "demonhunter:havoc": { spellId: 183752, name: "Disrupt" },
  "demonhunter:devourer": { spellId: 183752, name: "Disrupt" },
  "demonhunter:vengeance": { spellId: 183752, name: "Disrupt" },
  // Druid — split
  "druid:balance": { spellId: 78675, name: "Solar Beam" },
  "druid:feral": { spellId: 106839, name: "Skull Bash" },
  "druid:guardian": { spellId: 106839, name: "Skull Bash" },
  "druid:restoration": { spellId: 106839, name: "Skull Bash" },
  // Evoker — Quell
  "evoker:augmentation": { spellId: 351338, name: "Quell" },
  "evoker:devastation": { spellId: 351338, name: "Quell" },
  "evoker:preservation": { spellId: 351338, name: "Quell" },
  // Hunter — split
  "hunter:beastmastery": { spellId: 147362, name: "Counter Shot" },
  "hunter:marksmanship": { spellId: 147362, name: "Counter Shot" },
  "hunter:survival": { spellId: 187707, name: "Muzzle" },
  // Mage — Counterspell
  "mage:arcane": { spellId: 2139, name: "Counterspell" },
  "mage:fire": { spellId: 2139, name: "Counterspell" },
  "mage:frost": { spellId: 2139, name: "Counterspell" },
  // Monk — Spear Hand Strike
  "monk:brewmaster": { spellId: 116705, name: "Spear Hand Strike" },
  "monk:mistweaver": { spellId: 116705, name: "Spear Hand Strike" },
  "monk:windwalker": { spellId: 116705, name: "Spear Hand Strike" },
  // Paladin — Rebuke
  "paladin:holy": { spellId: 96231, name: "Rebuke" },
  "paladin:protection": { spellId: 96231, name: "Rebuke" },
  "paladin:retribution": { spellId: 96231, name: "Rebuke" },
  // Priest — Silence (Shadow only has a real kick)
  "priest:shadow": { spellId: 15487, name: "Silence" },
  // Rogue — Kick
  "rogue:assassination": { spellId: 1766, name: "Kick" },
  "rogue:outlaw": { spellId: 1766, name: "Kick" },
  "rogue:subtlety": { spellId: 1766, name: "Kick" },
  // Shaman — Wind Shear
  "shaman:elemental": { spellId: 57994, name: "Wind Shear" },
  "shaman:enhancement": { spellId: 57994, name: "Wind Shear" },
  "shaman:restoration": { spellId: 57994, name: "Wind Shear" },
  // Warlock — split by pet
  "warlock:affliction": { spellId: 19647, name: "Spell Lock" },
  "warlock:destruction": { spellId: 19647, name: "Spell Lock" },
  "warlock:demonology": { spellId: 89766, name: "Axe Toss" },
  // Warrior — Pummel
  "warrior:arms": { spellId: 6552, name: "Pummel" },
  "warrior:fury": { spellId: 6552, name: "Pummel" },
  "warrior:protection": { spellId: 6552, name: "Pummel" },
};

/** The kick a spec brings, or null (e.g. Disc/Holy priest have no dedicated kick). */
export function interruptForSpec(specId: string | null | undefined): InterruptDef | null {
  if (!specId) return null;
  return INTERRUPTS[specId] ?? null;
}
