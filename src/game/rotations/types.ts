// Rotation rule packs: what a spec is SUPPOSED to do, per patch.
//
// This is the one place in the app that carries patch-specific rotation
// knowledge on purpose. The rest of the analysis engine is deliberately the
// opposite - src/server/analysis/advice.js derives every sentence from the diff
// between two runs so it survives patches untouched. That design can say "they
// pressed this 20% more than you"; it can never say "you let your disease drop",
// because nothing in a data diff knows a disease is supposed to be up.
//
// So: rules live here, as DATA, versioned by patch, each one carrying the URL it
// came from. Consequences of that choice, all intentional:
//   - Nothing fetches a guide at request time. Rule packs are read from disk.
//   - A wrong rule is traceable to a source and a read date, not folklore.
//   - Adding a spec is a new data file, never new checker code. If a spec needs
//     a rule kind that doesn't exist yet, add the kind to the union below and
//     teach src/server/analysis/rotationRules.js one new case.
//
// Refresh the raw source text with `node scripts/rotation-source-refresh.mjs <specId>`
// when a patch lands, then re-author the rules from the dump.

/** Where a rule came from, so a stale claim can be chased down. */
export interface RotationSource {
  label: string;
  url: string;
  /** ISO date the text behind `url` was actually read. */
  readAt: string;
}

/**
 * A hero-talent (or otherwise mutually exclusive) build. Detected from the run
 * itself rather than from a talent string, because WCL's `CombatantInfo` talent
 * payload is a loadout blob we don't decode - but the abilities and auras a
 * build grants are right there in the Casts/Buffs tables.
 */
export interface RotationBuild {
  id: string;
  label: string;
  detect: {
    /** Any one of these ability names appearing in the Casts table picks this build. */
    anyCast?: string[];
    /** Any one of these aura names appearing in the Buffs table picks this build. */
    anyBuff?: string[];
  };
}

/** How hard the guides lean on a rule. The checker may downgrade, never upgrade. */
export type RuleSeverity = "high" | "medium" | "low";

interface RuleBase {
  /** Stable, unique within a pack - the finding's id and the React key. */
  id: string;
  severity: RuleSeverity;
  /** The guide's own justification, shown to the player verbatim-ish. */
  why: string;
  /** Index into the pack's `sources`. */
  sourceIndex: number;
  /** Restrict to one build id; omit to apply to every build. */
  build?: string;
}

/**
 * An aura that should be kept up. `target: "enemy"` reads the Debuffs table
 * (diseases and dots), `"self"` reads Buffs. Measured against ENGAGED time, not
 * wall-clock: a disease is not "dropped" while you walk between M+ pulls.
 */
export interface AuraUptimeRule extends RuleBase {
  kind: "aura_uptime";
  aura: string;
  target: "self" | "enemy";
  minPct: number;
}

/**
 * A cooldown that should be spent as often as it comes up. Waste is engaged time
 * where the ability was off cooldown and unpressed, as a share of engaged time -
 * so holding a cooldown through a corpse run or a trash skip costs nothing here.
 */
export interface CooldownDriftRule extends RuleBase {
  kind: "cooldown_drift";
  ability: string;
  cooldownMs: number;
  /** Flag when wasted engaged time exceeds this share of engaged time. */
  maxWastePct: number;
}

/** Two cooldowns that are supposed to be pressed together. */
export interface CooldownAlignmentRule extends RuleBase {
  kind: "cooldown_alignment";
  a: string;
  b: string;
  withinMs: number;
  /** Flag when this share of `a` casts had no `b` cast nearby. */
  maxUnpairedPct: number;
}

/**
 * Abilities that must all appear early in the first pull. Deliberately checks
 * PRESENCE inside a window, not exact order: real openers legitimately shuffle
 * around a pull's timing, but a cooldown missing from the opener entirely is
 * always a mistake.
 */
export interface OpenerSequenceRule extends RuleBase {
  kind: "opener_sequence";
  expected: string[];
  /** Window after the first cast in which the expected abilities should land. */
  graceMs: number;
}

/** Overcapping the spec's primary resource. Uses WCL's own per-event `waste`. */
export interface ResourceWasteRule extends RuleBase {
  kind: "resource_waste";
  /** Must match the resource name in src/server/analysis/resources.js POWER_TYPES. */
  resource: string;
  maxWastePct: number;
}

/**
 * An ability that is supposed to be pressed inside a window: Putrefy during Dark
 * Transformation, Scourge Strike while a Lesser Ghoul stack is banked, a potion
 * during a burst window. Buff bands give the window, cast timestamps give the
 * presses, so this needs no cooldown or resource state.
 */
export interface CastDuringBuffRule extends RuleBase {
  kind: "cast_during_buff";
  ability: string;
  buff: string;
  /** Flag when fewer than this share of casts landed inside a window. */
  minPct: number;
  /** Ignore runs with fewer casts than this - a 1-of-2 miss is not a habit. */
  minCasts?: number;
}

/**
 * A press that did nothing because what it applies was already there - the
 * clearest kind of wasted global. SimC gates Outbreak on
 * `dot.dread_plague.active_dots=0|dot.virulent_plague.active_dots=0`, i.e. cast
 * it only when a disease is actually missing.
 */
export interface RedundantCastRule extends RuleBase {
  kind: "redundant_cast";
  ability: string;
  /** Casting while ANY of these was already up is the wasted case. */
  whileAnyUp: string[];
  target: "self" | "enemy";
  maxPct: number;
  minCasts?: number;
}

/**
 * A proc window that expired with nothing spending it. Band-based, so it counts
 * windows rather than stacks - a multi-stack proc consumed once still reads as
 * used, which keeps this conservative rather than accusatory.
 */
export interface ProcWasteRule extends RuleBase {
  kind: "proc_waste";
  buff: string;
  /** Any of these casts inside the window counts as spending it. */
  consumedBy: string[];
  maxPct: number;
  minWindows?: number;
}

export type RotationRule =
  | AuraUptimeRule
  | CooldownDriftRule
  | CooldownAlignmentRule
  | OpenerSequenceRule
  | ResourceWasteRule
  | CastDuringBuffRule
  | RedundantCastRule
  | ProcWasteRule;

export interface RotationSpec {
  /** Matches SpecDef.id in src/game/classes.ts, e.g. "deathknight:unholy". */
  specId: string;
  specLabel: string;
  /** Patch the rules were authored for; compared against the season's patch. */
  patch: string;
  sources: RotationSource[];
  builds: RotationBuild[];
  /** Build assumed when no detector matches. */
  defaultBuild: string;
  rules: RotationRule[];
}
