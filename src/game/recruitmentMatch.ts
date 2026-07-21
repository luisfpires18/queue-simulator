// Mythic+ recruitment compatibility. Pure functions, no I/O.
//
// Deliberately NOT a single score. The product rule is that a candidate is
// explained, not ranked: each dimension answers independently and carries its
// own sentence, so the UI can print "Strong schedule overlap" next to "Fills
// the permanent healer position" instead of an unexplained 87%.
//
// Nothing here reads Warcraft Logs or parse percentiles. Performance data is
// supporting evidence shown on request (a later phase), never an input to
// whether two people are compatible.

import { overlapMinutes, overlappingDays, DAY_LABELS, type WeeklySlot } from "./availability";
import { GOAL_NEIGHBOURS, GOAL_LABEL, languageLabel, type TeamGoal } from "./recruitmentTypes";
import { specById } from "./classes";

/** One dimension's verdict. `level` drives grouping and colour, `reason` is the
 * sentence shown to the user, `detail` the optional longer form for a drawer. */
export interface MatchFacet {
  level: "strong" | "partial" | "none";
  reason: string;
  detail?: string;
}

const NO_DATA = (what: string): MatchFacet => ({
  level: "none",
  reason: `No ${what} information provided`,
  // Spelled out rather than silently scoring zero: the spec requires that a
  // player is never penalised for missing data without being told why.
  detail: `This cannot be compared because one side has not filled in their ${what}.`,
});

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

/** Does the candidate cover the role a position needs?
 *
 * `willingRoles` is what makes an off-spec tank visible: a healer main who
 * lists TANK as willing is a partial match for a tank opening, not a miss. */
export function roleMatch(
  candidateRole: string,
  willingRoles: readonly string[],
  neededRole: string
): MatchFacet {
  if (candidateRole === neededRole) {
    return { level: "strong", reason: `Plays ${neededRole.toLowerCase()}, the role being recruited` };
  }
  if (willingRoles.includes(neededRole)) {
    return {
      level: "partial",
      reason: `Willing to play ${neededRole.toLowerCase()}`,
      detail: `Their main role is ${candidateRole.toLowerCase()}, but they listed ${neededRole.toLowerCase()} as a role they will play.`,
    };
  }
  return {
    level: "none",
    reason: `Plays ${candidateRole.toLowerCase()}, not ${neededRole.toLowerCase()}`,
  };
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

function specName(specId: string): string {
  const s = specById(specId);
  return s ? s.name : specId;
}

/** Preferred vs accepted specs answer different questions, so they are graded
 * apart: hitting a preferred spec is a strong match, hitting only the accepted
 * list is partial, and an EMPTY accepted list means the team said "any spec in
 * the role" - which is a strong match, not a missing one. */
export function specMatch(
  primarySpecId: string,
  alternateSpecIds: readonly string[],
  preferredSpecIds: readonly string[],
  acceptedSpecIds: readonly string[]
): MatchFacet {
  const mine = [primarySpecId, ...alternateSpecIds];

  if (preferredSpecIds.includes(primarySpecId)) {
    return { level: "strong", reason: `${specName(primarySpecId)} is a preferred spec` };
  }
  if (acceptedSpecIds.includes(primarySpecId)) {
    return { level: "strong", reason: `${specName(primarySpecId)} is an accepted spec` };
  }

  // No spec preference at all: the role is the only requirement.
  if (!preferredSpecIds.length && !acceptedSpecIds.length) {
    return { level: "strong", reason: "Any spec in this role is accepted" };
  }

  const altPreferred = alternateSpecIds.find((s) => preferredSpecIds.includes(s));
  if (altPreferred) {
    return {
      level: "partial",
      reason: `Off-spec ${specName(altPreferred)} is preferred`,
      detail: `They main ${specName(primarySpecId)} but listed ${specName(altPreferred)} as an alternate spec, which is one the team wants.`,
    };
  }
  const altAccepted = alternateSpecIds.find((s) => acceptedSpecIds.includes(s));
  if (altAccepted) {
    return {
      level: "partial",
      reason: `Off-spec ${specName(altAccepted)} is accepted`,
      detail: `They main ${specName(primarySpecId)} but can play ${specName(altAccepted)}, which the team accepts.`,
    };
  }

  const wanted = (preferredSpecIds.length ? preferredSpecIds : acceptedSpecIds).map(specName).join(", ");
  return {
    level: "none",
    reason: `Plays ${mine.map(specName).join("/")}, team wants ${wanted}`,
  };
}

/** Does having a second spec add genuine roster flexibility - i.e. an
 * alternate spec in a DIFFERENT role from the main one? This is what produces
 * the "alternate tank spec adds roster flexibility" explanation. */
export function flexibilityMatch(primarySpecId: string, alternateSpecIds: readonly string[]): MatchFacet {
  const primaryRole = specById(primarySpecId)?.role;
  const crossRole = alternateSpecIds
    .map((id) => specById(id))
    .filter((s): s is NonNullable<typeof s> => !!s && s.role !== primaryRole);

  if (!crossRole.length) {
    return { level: "none", reason: "No off-role specs listed" };
  }
  const roles = [...new Set(crossRole.map((s) => s.role.toLowerCase()))].join(" and ");
  return {
    level: "strong",
    reason: `Alternate ${roles} spec adds roster flexibility`,
    detail: `Can also play ${crossRole.map((s) => s.name).join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Key range
// ---------------------------------------------------------------------------

export interface KeyRange {
  min: number | null;
  max: number | null;
}

/** Treats a null bound as open-ended, which is how the form means it ("+18 and
 * up"). Returns null when neither side declared anything. */
function rangeOverlapSize(a: KeyRange, b: KeyRange): number | null {
  const aMin = a.min ?? b.min ?? null;
  const aMax = a.max ?? b.max ?? null;
  const bMin = b.min ?? a.min ?? null;
  const bMax = b.max ?? a.max ?? null;
  if (aMin === null && aMax === null && bMin === null && bMax === null) return null;

  const lo = Math.max(aMin ?? -Infinity, bMin ?? -Infinity);
  const hi = Math.min(aMax ?? Infinity, bMax ?? Infinity);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return hi >= lo ? Infinity : 0;
  return Math.max(0, hi - lo + 1);
}

function formatRange(r: KeyRange): string {
  if (r.min !== null && r.max !== null) return r.min === r.max ? `+${r.min}` : `+${r.min} to +${r.max}`;
  if (r.min !== null) return `+${r.min} and up`;
  if (r.max !== null) return `up to +${r.max}`;
  return "any level";
}

/** Compares where the candidate runs now against where the team runs now.
 *
 * Being slightly BELOW the team's range is a partial match, not a rejection -
 * "has experience one level below the team's current range" is an explanation
 * the spec asks for by name, because a player one key off is a normal hire. */
export function keyRangeMatch(candidate: KeyRange, team: KeyRange): MatchFacet {
  const overlap = rangeOverlapSize(candidate, team);
  if (overlap === null) return NO_DATA("key range");

  if (overlap > 0) {
    return {
      level: "strong",
      reason: `Runs ${formatRange(candidate)}, matching the team's ${formatRange(team)}`,
    };
  }

  const candidateTop = candidate.max ?? candidate.min;
  const teamFloor = team.min ?? team.max;
  if (candidateTop !== null && teamFloor !== null) {
    const gap = teamFloor - candidateTop;
    if (gap > 0 && gap <= 2) {
      return {
        level: "partial",
        reason: `Has experience ${gap} level${gap === 1 ? "" : "s"} below the team's current range`,
        detail: `They run ${formatRange(candidate)}; the team runs ${formatRange(team)}.`,
      };
    }
    if (gap < 0) {
      return {
        level: "partial",
        reason: `Runs above the team's current range`,
        detail: `They run ${formatRange(candidate)}, higher than the team's ${formatRange(team)}. Worth checking they still want this range.`,
      };
    }
  }
  return {
    level: "none",
    reason: `Runs ${formatRange(candidate)}, team runs ${formatRange(team)}`,
  };
}

/** Where both sides want to END UP, which is a different question from where
 * they are now - a learning player and a title team can overlap today and
 * still be a bad fit. */
export function targetKeyMatch(candidate: KeyRange, team: KeyRange): MatchFacet {
  const overlap = rangeOverlapSize(candidate, team);
  if (overlap === null) return NO_DATA("target key range");
  if (overlap > 0) {
    return { level: "strong", reason: `Both aiming for ${formatRange(team)}` };
  }
  return {
    level: "partial",
    reason: `Aims for ${formatRange(candidate)}, team aims for ${formatRange(team)}`,
  };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** Below this a shared window is too thin to run keys in. One key plus
 * invites/regroup is comfortably over an hour, so two hours a week is the
 * floor for calling anything a real overlap. */
const STRONG_OVERLAP_MINUTES = 120;
const PARTIAL_OVERLAP_MINUTES = 45;

/** Both slot lists must ALREADY be in the same frame of reference - shift each
 * side with shiftToUtc() before calling, since a raw comparison of two local
 * schedules silently equates 20:00 Lisbon with 20:00 Sydney. */
export function scheduleMatch(a: WeeklySlot[], b: WeeklySlot[]): MatchFacet {
  if (!a.length || !b.length) return NO_DATA("availability");

  const minutes = overlapMinutes(a, b);
  const days = overlappingDays(a, b);
  const dayText = days.map((d) => DAY_LABELS[d]).join(", ");
  const hours = Math.round((minutes / 60) * 10) / 10;

  if (minutes >= STRONG_OVERLAP_MINUTES) {
    return {
      level: "strong",
      reason: `Strong schedule overlap on ${dayText}`,
      detail: `About ${hours} hours a week when both are available.`,
    };
  }
  if (minutes >= PARTIAL_OVERLAP_MINUTES) {
    return {
      level: "partial",
      reason: `Some schedule overlap on ${dayText}`,
      detail: `About ${hours} hours a week - workable, but tight.`,
    };
  }
  return { level: "none", reason: "Schedules do not overlap" };
}

// ---------------------------------------------------------------------------
// Language, goal, voice
// ---------------------------------------------------------------------------

export function languageMatch(a: readonly string[], b: readonly string[]): MatchFacet {
  if (!a.length || !b.length) return NO_DATA("language");
  const shared = a.filter((l) => b.includes(l));
  if (!shared.length) return { level: "none", reason: "No shared language" };
  return {
    level: "strong",
    reason: `Both speak ${shared.map(languageLabel).join(", ")}`,
  };
}

export function goalMatch(a: string, b: string): MatchFacet {
  if (!a || !b) return NO_DATA("goal");
  if (a === b) {
    return { level: "strong", reason: `Matches the team's ${GOAL_LABEL[b as TeamGoal]?.toLowerCase() ?? b} goal` };
  }
  if (GOAL_NEIGHBOURS[a as TeamGoal]?.includes(b as TeamGoal)) {
    return {
      level: "partial",
      reason: `Similar goals`,
      detail: `They want ${GOAL_LABEL[a as TeamGoal] ?? a}, the team wants ${GOAL_LABEL[b as TeamGoal] ?? b}.`,
    };
  }
  return {
    level: "none",
    reason: `Wants ${GOAL_LABEL[a as TeamGoal] ?? a}, team wants ${GOAL_LABEL[b as TeamGoal] ?? b}`,
  };
}

export function voiceMatch(candidateHasVoice: boolean, teamRequiresVoice: boolean): MatchFacet {
  if (!teamRequiresVoice) return { level: "strong", reason: "Voice is not required" };
  if (candidateHasVoice) return { level: "strong", reason: "Has voice chat, which the team requires" };
  return { level: "none", reason: "Team requires voice chat" };
}

// ---------------------------------------------------------------------------
// Position fit
// ---------------------------------------------------------------------------

export interface PositionLike {
  role: string;
  preferredSpecIds: string[];
  acceptedSpecIds: string[];
  isPermanent: boolean;
  isFlexible: boolean;
  isFilled: boolean;
}

export interface CandidateLike {
  primarySpecId: string;
  alternateSpecIds: string[];
  preferredRole: string;
  willingRoles: string[];
}

/** The headline explanation: which specific opening does this candidate fill?
 * Returns the best open position plus the sentence naming it, or null when
 * nothing fits. */
export function bestPositionFor(
  candidate: CandidateLike,
  positions: readonly PositionLike[]
): { position: PositionLike; facet: MatchFacet } | null {
  const rank = { strong: 2, partial: 1, none: 0 } as const;
  let best: { position: PositionLike; facet: MatchFacet; score: number } | null = null;

  for (const p of positions) {
    if (p.isFilled) continue;
    const role = roleMatch(candidate.preferredRole, candidate.willingRoles, p.role);
    if (role.level === "none" && !p.isFlexible) continue;

    const spec = specMatch(candidate.primarySpecId, candidate.alternateSpecIds, p.preferredSpecIds, p.acceptedSpecIds);
    if (spec.level === "none") continue;

    const score = rank[role.level] * 2 + rank[spec.level];
    const seat = p.isPermanent ? "permanent" : "substitute";
    const facet: MatchFacet = {
      level: role.level === "strong" && spec.level === "strong" ? "strong" : "partial",
      reason: `Fills the ${seat} ${p.role.toLowerCase()} position`,
      detail: `${role.reason}. ${spec.reason}.`,
    };
    if (!best || score > best.score) best = { position: p, facet, score };
  }
  return best ? { position: best.position, facet: best.facet } : null;
}

// ---------------------------------------------------------------------------
// Fair ordering
// ---------------------------------------------------------------------------

export interface OrderableCandidate {
  id: string;
  createdAt: string; // ISO
  lastActiveAt?: string | null; // ISO
}

/** Buckets candidates by how many facets came back strong. This is the ONLY
 * aggregation performed anywhere in this module, and it is intentionally
 * coarse - a bucket, not a rank. */
export function compatibilityBucket(facets: readonly MatchFacet[]): number {
  return facets.filter((f) => f.level === "strong").length;
}

/** Orders equally-compatible candidates fairly.
 *
 * Explicitly NOT by rating and NOT by logs - the spec forbids both as a
 * default sort, because sorting a recruitment queue by parse is how a board
 * turns into a leaderboard. Within a compatibility bucket the order is:
 * application time first, then recent activity, then a stable per-candidate
 * jitter so the same person doesn't permanently own the top of the list.
 *
 * `seed` makes the rotation deterministic per render (pass e.g. the viewing
 * day) so the order is stable within a session but rotates between them. */
export function fairOrder<T extends OrderableCandidate>(candidates: readonly T[], seed = 0): T[] {
  return [...candidates].sort((a, b) => {
    const at = Date.parse(a.createdAt) || 0;
    const bt = Date.parse(b.createdAt) || 0;
    if (at !== bt) return at - bt; // earliest application first

    const aa = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0;
    const ba = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0;
    if (aa !== ba) return ba - aa; // more recently active first

    return jitter(a.id, seed) - jitter(b.id, seed);
  });
}

/** Deterministic 0..1 from an id + seed. A hash rather than Math.random so the
 * order doesn't reshuffle on every re-render inside one session. */
function jitter(id: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** What an applicant brings, as the matcher needs it. Assembled from a
 * RecruitmentApplication plus the applicant's own post if they have one. */
export interface ApplicantProfile {
  primarySpecId: string;
  alternateSpecIds: string[];
  preferredRole: string;
  willingRoles: string[];
  /** Already shifted to UTC by the caller - see shiftToUtc. Comparing raw
   * local schedules would equate 20:00 Lisbon with 20:00 Sydney. */
  availability: WeeklySlot[];
  languages: string[];
  goal?: string | null;
  currentKeyMin?: number | null;
  currentKeyMax?: number | null;
  targetKeyMin?: number | null;
  targetKeyMax?: number | null;
  hasVoice?: boolean;
}

/** The team side of the comparison, same UTC-shifted contract. */
export interface TeamProfile {
  availability: WeeklySlot[];
  languages: string[];
  goal: string;
  currentKeyMin: number | null;
  currentKeyMax: number | null;
  targetKeyMin: number | null;
  targetKeyMax: number | null;
  voiceRequired: boolean;
  positions: PositionLike[];
}

/** Every dimension of an M+ application, each explained separately.
 *
 * This is an ORDERED LIST, not a score. The order is the order a recruiter
 * cares about - which opening does this person fill, then can they make the
 * times, then everything else - and callers render it as-is. Nothing here
 * multiplies the facets together, and nothing reads Warcraft Logs. */
export function explainApplication(applicant: ApplicantProfile, team: TeamProfile): MatchFacet[] {
  const facets: MatchFacet[] = [];

  const position = bestPositionFor(applicant, team.positions);
  if (position) facets.push(position.facet);

  facets.push(scheduleMatch(applicant.availability, team.availability));

  facets.push(
    keyRangeMatch(
      { min: applicant.currentKeyMin ?? null, max: applicant.currentKeyMax ?? null },
      { min: team.currentKeyMin, max: team.currentKeyMax }
    )
  );

  if (applicant.goal) facets.push(goalMatch(applicant.goal, team.goal));

  facets.push(languageMatch(applicant.languages, team.languages));
  facets.push(voiceMatch(applicant.hasVoice ?? false, team.voiceRequired));

  // Only mentioned when it is actually true - "no off-role specs listed" is
  // noise on a card, not an insight.
  const flex = flexibilityMatch(applicant.primarySpecId, applicant.alternateSpecIds);
  if (flex.level !== "none") facets.push(flex);

  return facets;
}
