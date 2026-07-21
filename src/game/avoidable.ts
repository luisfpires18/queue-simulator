// Versioned AVOIDABLE-DAMAGE dataset + selector.
//
// Real "avoidable damage taken" is not a flag WCL's API exposes — it must be
// derived: pull the player's DamageTaken events and total only the hits from
// abilities WE declare avoidable. That declaration lives here, per the rule that
// damage must NOT be classified blindly: targeted hits, required soaks,
// debuff-clearing damage and unavoidable group damage are NOT the player's
// fault, so each ability carries the context needed to judge it fairly.
//
// Only `alwaysAvoidable: true` rows are auto-counted. Conditional rows (soaks /
// required damage / positional) are documented but NOT summed automatically —
// evaluating their condition needs combat context we don't model, and counting
// them blindly would wrongly blame the player.
//
// This is a SEED: the schema + engine are complete; the row set is curated over
// time from real logs. Bump AVOIDABLE_DATASET_VERSION whenever rows change so a
// score is always reproducible against a known dataset.
import type { Role } from "./classes";
import { DUNGEON_BY_ID } from "./season";

export const AVOIDABLE_DATASET_VERSION = "midnight-s1-v0";

export interface AvoidableAbility {
  spellId: number;
  name: string;
  /** season.ts DUNGEONS id, or null = applies in any dungeon (affix/environment). */
  dungeonId: string | null;
  category: string; // swirl | frontal | voidzone | beam | explosion | affix | ...
  severity: "low" | "medium" | "high";
  /** false = conditional (see `condition`) — documented but NOT auto-counted. */
  alwaysAvoidable: boolean;
  condition?: string; // human rule for a conditional/soak/required-damage ability
  ignoreRoles?: Role[]; // roles for whom this is expected (e.g. tank eats it)
  ignoreSpecs?: string[]; // specId exceptions
}

// Curated rows go here. Verify every spellId against live logs before trusting
// its numbers. Example of the intended shape (commented so an empty seed counts
// nothing rather than counting a guessed id):
//
//   { spellId: 12345, name: "Toxic Slick", dungeonId: "pos", category: "voidzone",
//     severity: "high", alwaysAvoidable: true },
//   { spellId: 67890, name: "Meteor Soak", dungeonId: "aa", category: "soak",
//     severity: "high", alwaysAvoidable: false, condition: "required 2-player soak",
//     ignoreRoles: ["TANK"] },
export const AVOIDABLE: AvoidableAbility[] = [];

/**
 * The auto-countable avoidable abilities for one player in one dungeon: always-
 * avoidable rows for this dungeon (or dungeon-agnostic), minus rows this player's
 * role/spec is exempt from. `dungeonId` may be null (dungeon unknown) — then only
 * dungeon-agnostic rows apply.
 */
export function avoidableFor(dungeonId: string | null, role: Role, specId: string | null): AvoidableAbility[] {
  const known = dungeonId != null && DUNGEON_BY_ID[dungeonId] != null ? dungeonId : null;
  return AVOIDABLE.filter((a) => {
    if (!a.alwaysAvoidable) return false;
    if (a.dungeonId != null && a.dungeonId !== known) return false;
    if (role && a.ignoreRoles?.includes(role)) return false;
    if (specId && a.ignoreSpecs?.includes(specId)) return false;
    return true;
  });
}

/** Whether the dataset has any auto-countable rows for this dungeon+player. */
export function hasAvoidableData(dungeonId: string | null, role: Role, specId: string | null): boolean {
  return avoidableFor(dungeonId, role, specId).length > 0;
}
