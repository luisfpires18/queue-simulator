// Trash-skip tools — abilities that let a group walk past packs instead of
// fighting them. Class-wide (any spec of the class brings it), same shape as
// buffs.ts, so it plugs into computeClassCoverage.
import type { ClassId } from "./classes";

export interface SkipDef {
  id: string;
  name: string;
  short: string;
  icon: string; // spell icon slug
  description: string;
  requiresTalent?: boolean;
  providerClasses: ClassId[];
}

export const SKIPS: SkipDef[] = [
  { id: "shroud", name: "Shroud of Concealment", short: "Shroud", icon: "ability_rogue_shroudofconcealment", description: "Rogue. Cloaks the whole party so you can slip past packs and skip trash.", providerClasses: ["rogue"] },
  { id: "weyrnstone", name: "Bestow Weyrnstone", short: "Weyrnstone", icon: "ability_evoker_bestowweyrnstone", description: "Evoker, when talented. Hands out a paired teleport stone so two players can jump to each other across a skip.", requiresTalent: true, providerClasses: ["evoker"] },
  { id: "rescue", name: "Rescue", short: "Rescue", icon: "ability_evoker_flywithme", description: "Evoker. Grabs an ally and flies them forward - used to pull people through a skip.", providerClasses: ["evoker"] },
  { id: "gateway", name: "Demonic Gateway", short: "Gateway", icon: "spell_warlock_demonicportal_green", description: "Warlock, when talented. A two-way portal to jump the party across a gap or past a pull.", requiresTalent: true, providerClasses: ["warlock"] },
  { id: "imprison", name: "Imprison", short: "Imprison", icon: "ability_demonhunter_imprison", description: "Demon Hunter. Incapacitates a demon/beast/undead for a minute, so a pack can be CC'd out and skipped.", providerClasses: ["demonhunter"] },
];

export const SKIP_BY_ID: Record<string, SkipDef> = Object.fromEntries(SKIPS.map((s) => [s.id, s]));
