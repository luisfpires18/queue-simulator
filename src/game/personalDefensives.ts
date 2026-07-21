// Personal (self-cast) defensive cooldowns that show up as a BUFF on the caster,
// keyed by classId. Used to count defensive presses on the applicant scan and,
// via their buff bands, to test whether a defensive actually overlapped incoming
// damage ("did it mitigate"). Distinct from:
//   - defensives.ts          — party-wide raid defensives (AMZ, Rallying Cry...)
//   - externalDefensives.ts  — cast on someone ELSE (Pain Sup, Ironbark...)
//
// Beta coverage: the iconic, long-stable class defensives (spellIds are live
// values). Not exhaustive per spec/talent — add rows as gaps surface. Matching
// is by spellId against the Buffs table aura guid, so a missing row just means
// that one cooldown isn't counted, never a wrong count.

export interface PersonalDefensiveDef {
  spellId: number;
  name: string;
}

export const PERSONAL_DEFENSIVES: Record<string, PersonalDefensiveDef[]> = {
  deathknight: [
    { spellId: 48792, name: "Icebound Fortitude" },
    { spellId: 48707, name: "Anti-Magic Shell" },
    { spellId: 55233, name: "Vampiric Blood" },
  ],
  demonhunter: [
    { spellId: 198589, name: "Blur" },
    { spellId: 196555, name: "Netherwalk" },
    { spellId: 203720, name: "Demon Spikes" },
    { spellId: 187827, name: "Metamorphosis (Veng)" },
  ],
  druid: [
    { spellId: 22812, name: "Barkskin" },
    { spellId: 61336, name: "Survival Instincts" },
    { spellId: 22842, name: "Frenzied Regeneration" },
  ],
  evoker: [
    { spellId: 363916, name: "Obsidian Scales" },
    { spellId: 374348, name: "Renewing Blaze" },
  ],
  hunter: [
    { spellId: 186265, name: "Aspect of the Turtle" },
    { spellId: 264735, name: "Survival of the Fittest" },
  ],
  mage: [
    { spellId: 45438, name: "Ice Block" },
    { spellId: 11426, name: "Ice Barrier" },
    { spellId: 235450, name: "Prismatic Barrier" },
  ],
  monk: [
    { spellId: 115203, name: "Fortifying Brew" },
    { spellId: 122470, name: "Touch of Karma" },
    { spellId: 122278, name: "Dampen Harm" },
    { spellId: 122783, name: "Diffuse Magic" },
  ],
  paladin: [
    { spellId: 642, name: "Divine Shield" },
    { spellId: 498, name: "Divine Protection" },
    { spellId: 31850, name: "Ardent Defender" },
    { spellId: 86659, name: "Guardian of Ancient Kings" },
  ],
  priest: [
    { spellId: 47585, name: "Dispersion" },
    { spellId: 19236, name: "Desperate Prayer" },
    { spellId: 586, name: "Fade" },
  ],
  rogue: [
    { spellId: 31224, name: "Cloak of Shadows" },
    { spellId: 5277, name: "Evasion" },
    { spellId: 185311, name: "Crimson Vial" },
    { spellId: 1966, name: "Feint" },
  ],
  shaman: [
    { spellId: 108271, name: "Astral Shift" },
  ],
  warlock: [
    { spellId: 104773, name: "Unending Resolve" },
    { spellId: 108416, name: "Dark Pact" },
  ],
  warrior: [
    { spellId: 871, name: "Shield Wall" },
    { spellId: 118038, name: "Die by the Sword" },
    { spellId: 184364, name: "Enraged Regeneration" },
    { spellId: 12975, name: "Last Stand" },
    { spellId: 23920, name: "Spell Reflection" },
  ],
};

/** All personal-defensive spellIds for a class, or [] if unknown. */
export function personalDefensivesForClass(classId: string | null | undefined): PersonalDefensiveDef[] {
  if (!classId) return [];
  return PERSONAL_DEFENSIVES[classId] ?? [];
}
