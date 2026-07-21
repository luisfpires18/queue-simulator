// Raid/guild recruitment compatibility. Pure functions, no I/O.
//
// Same rule as recruitmentMatch.ts: separate explained facets, never one
// blended score, and never parse percentile as an input. A guild recruits on
// "can you make Tuesday and Thursday" and "have you seen this boss", not on a
// colour.

import { overlappingDays, type WeeklySlot } from "./availability";
import { DAY_LABELS } from "./availability";
import {
  DIFFICULTY_ORDER,
  RAID_DIFFICULTY_LABEL,
  type BossExperience,
  type RaidDifficulty,
} from "./recruitmentTypes";
import { languageMatch, type MatchFacet } from "./recruitmentMatch";

export type { MatchFacet };

// ---------------------------------------------------------------------------
// Raid nights
// ---------------------------------------------------------------------------

/** Raid recruitment cares about whole NIGHTS, not minutes: a guild that raids
 * Tue/Wed/Thu needs you on all three, and being free for half of Wednesday is
 * not half a match. So this counts covered raid days rather than reusing
 * recruitmentMatch's minute-based scheduleMatch.
 *
 * Both lists must already be in the same frame of reference (shiftToUtc). */
export function raidDayMatch(raiderSlots: WeeklySlot[], raidNights: WeeklySlot[]): MatchFacet {
  const nightDays = [...new Set(raidNights.map((s) => s.day))];
  if (!nightDays.length || !raiderSlots.length) {
    return {
      level: "none",
      reason: "No availability information provided",
      detail: "This cannot be compared because one side has not filled in their schedule.",
    };
  }

  const covered = overlappingDays(raidNights, raiderSlots);
  const missing = nightDays.filter((d) => !covered.includes(d));

  if (!missing.length) {
    const n = nightDays.length;
    return {
      level: "strong",
      reason: `Available for all ${n} raid night${n === 1 ? "" : "s"}`,
      detail: `Covers ${nightDays.map((d) => DAY_LABELS[d]).join(", ")}.`,
    };
  }
  if (covered.length) {
    return {
      level: "partial",
      reason: `Available for ${covered.length} of ${nightDays.length} raid nights`,
      detail: `Cannot make ${missing.map((d) => DAY_LABELS[d]).join(", ")}.`,
    };
  }
  return {
    level: "none",
    reason: "Not available on any raid night",
    detail: `The team raids ${nightDays.map((d) => DAY_LABELS[d]).join(", ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export function difficultyMatch(preferred: string, teamDifficulty: string): MatchFacet {
  const a = DIFFICULTY_ORDER.indexOf(preferred as RaidDifficulty);
  const b = DIFFICULTY_ORDER.indexOf(teamDifficulty as RaidDifficulty);
  if (a < 0 || b < 0) {
    return { level: "none", reason: "No raid difficulty information provided" };
  }
  if (a === b) {
    return { level: "strong", reason: `Both want ${RAID_DIFFICULTY_LABEL[teamDifficulty as RaidDifficulty]}` };
  }
  // One step apart is a real conversation (a Heroic raider trying Mythic, or a
  // Mythic raider wanting a lighter tier). Two steps apart is not.
  if (Math.abs(a - b) === 1) {
    return {
      level: "partial",
      reason: `Prefers ${RAID_DIFFICULTY_LABEL[preferred as RaidDifficulty]}, team runs ${RAID_DIFFICULTY_LABEL[teamDifficulty as RaidDifficulty]}`,
    };
  }
  return {
    level: "none",
    reason: `Prefers ${RAID_DIFFICULTY_LABEL[preferred as RaidDifficulty]}, team runs ${RAID_DIFFICULTY_LABEL[teamDifficulty as RaidDifficulty]}`,
  };
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export interface Progression {
  raidId: string | null;
  bossesKilled: number | null;
  difficulty: string;
}

/** Bosses of difference between two progression points, normalised so a
 * Mythic kill outranks a Heroic one. Positive means `a` is AHEAD of `b`.
 *
 * Difficulty is worth a whole tier (20 bosses) rather than a few kills because
 * 2/8 Mythic is genuinely further than 8/8 Heroic, and a plain boss count
 * would rank them the wrong way round. Returns null when either side is
 * unknown - callers must not treat that as "equal". */
export function progressionDistance(a: Progression, b: Progression): number | null {
  if (a.bossesKilled === null || b.bossesKilled === null) return null;
  const TIER = 20;
  const aRank = DIFFICULTY_ORDER.indexOf(a.difficulty as RaidDifficulty) * TIER + a.bossesKilled;
  const bRank = DIFFICULTY_ORDER.indexOf(b.difficulty as RaidDifficulty) * TIER + b.bossesKilled;
  return aRank - bRank;
}

/** How a raider's progression sits against the guild's.
 *
 * Being slightly BEHIND is the normal case for a good hire and must not read
 * as a rejection - "current experience is one boss behind the guild" is an
 * explanation the spec calls for explicitly. Being ahead is also flagged,
 * since an over-qualified applicant usually leaves. */
export function progressionMatch(raider: Progression, guild: Progression): MatchFacet {
  const distance = progressionDistance(raider, guild);
  if (distance === null) {
    return {
      level: "none",
      reason: "No progression information provided",
      detail: "This cannot be compared because one side has not recorded their progression.",
    };
  }
  if (distance === 0) {
    return { level: "strong", reason: "Matches the guild's current progression boss" };
  }
  if (distance < 0) {
    const behind = -distance;
    if (behind <= 2) {
      return {
        level: "strong",
        reason: `Current experience is ${behind} boss${behind === 1 ? "" : "es"} behind the guild`,
        detail: "Close enough to slot straight into progression.",
      };
    }
    if (behind <= 5) {
      return {
        level: "partial",
        reason: `Current experience is ${behind} bosses behind the guild`,
        detail: "Would need to catch up on the bosses already cleared.",
      };
    }
    return { level: "none", reason: `Well behind the guild's progression (${behind} bosses)` };
  }
  return {
    level: "partial",
    reason: `Ahead of the guild's progression by ${distance} boss${distance === 1 ? "" : "es"}`,
    detail: "Worth confirming they are happy raiding at this pace.",
  };
}

// ---------------------------------------------------------------------------
// Boss experience
// ---------------------------------------------------------------------------

const STATE_RANK: Record<string, number> = {
  not_attempted: 0,
  progressed: 1,
  killed: 2,
  farm: 3,
};

/** Has the raider seen the specific boss the guild is stuck on? This is the
 * single most useful raid-recruitment signal and the reason bossExperience is
 * stored per boss rather than as one progression string.
 *
 * Progression experience without a kill still counts as partial: someone who
 * reached phase 3 knows the fight, which is exactly what a progression guild
 * is buying. */
export function bossExperienceMatch(
  experience: readonly BossExperience[],
  raidId: string,
  bossId: string,
  difficulty: RaidDifficulty
): MatchFacet {
  const relevant = experience.filter((e) => e.raidId === raidId && e.bossId === bossId);
  if (!relevant.length) {
    return { level: "none", reason: "No experience recorded on this boss" };
  }

  const wanted = DIFFICULTY_ORDER.indexOf(difficulty);
  // Best entry at or above the difficulty asked about - a Mythic kill also
  // proves Heroic experience, but not the other way round.
  const atOrAbove = relevant
    .filter((e) => DIFFICULTY_ORDER.indexOf(e.difficulty) >= wanted)
    .sort((x, y) => (STATE_RANK[y.state] ?? 0) - (STATE_RANK[x.state] ?? 0))[0];

  const diffLabel = RAID_DIFFICULTY_LABEL[difficulty];

  if (atOrAbove && (atOrAbove.state === "killed" || atOrAbove.state === "farm")) {
    const kills = atOrAbove.kills ?? 1;
    return {
      level: "strong",
      reason:
        atOrAbove.state === "farm"
          ? `Farm experience on ${diffLabel}`
          : `Killed ${diffLabel} ${kills} time${kills === 1 ? "" : "s"}`,
    };
  }
  if (atOrAbove && atOrAbove.state === "progressed") {
    return {
      level: "partial",
      reason: atOrAbove.phaseReached
        ? `Reached phase ${atOrAbove.phaseReached} on ${diffLabel}`
        : `Progression experience on ${diffLabel}`,
      detail: "No kill yet, but has pulled the fight at this difficulty.",
    };
  }

  // Only lower-difficulty experience exists.
  const lower = relevant
    .filter((e) => STATE_RANK[e.state] >= STATE_RANK.killed)
    .sort((x, y) => DIFFICULTY_ORDER.indexOf(y.difficulty) - DIFFICULTY_ORDER.indexOf(x.difficulty))[0];
  if (lower) {
    return {
      level: "partial",
      reason: `No ${diffLabel} kill, but killed it on ${RAID_DIFFICULTY_LABEL[lower.difficulty]}`,
      detail: "Knows the fight, not the harder version of it.",
    };
  }
  return { level: "none", reason: `No ${diffLabel} experience on this boss` };
}

// ---------------------------------------------------------------------------
// Attendance, trial, culture
// ---------------------------------------------------------------------------

export function attendanceMatch(raiderCanCommit: number | null, guildRequires: number | null): MatchFacet {
  if (raiderCanCommit === null || guildRequires === null) {
    return { level: "none", reason: "No attendance information provided" };
  }
  if (raiderCanCommit >= guildRequires) {
    return { level: "strong", reason: `Can commit to ${raiderCanCommit}%, the guild requires ${guildRequires}%` };
  }
  // Within 10 points is a conversation, not a disqualification.
  if (guildRequires - raiderCanCommit <= 10) {
    return {
      level: "partial",
      reason: `Can commit to ${raiderCanCommit}%, slightly under the guild's ${guildRequires}%`,
    };
  }
  return {
    level: "none",
    reason: `Can commit to ${raiderCanCommit}%, the guild requires ${guildRequires}%`,
  };
}

export function atmosphereMatch(raider: string | null, guild: string | null): MatchFacet {
  if (!raider || !guild) return { level: "none", reason: "No atmosphere preference provided" };
  if (raider === guild) {
    return { level: "strong", reason: "Preferred atmosphere and progression goals match" };
  }
  return { level: "partial", reason: `Prefers a ${raider} atmosphere, the guild describes itself as ${guild}` };
}

/** Off-role capability, phrased the way a raid lead reads it. */
export function offRoleMatch(offRoles: readonly string[], neededRole: string): MatchFacet {
  if (offRoles.includes(neededRole)) {
    return { level: "strong", reason: `Can switch to ${neededRole.toLowerCase()} when required` };
  }
  return { level: "none", reason: "No off-role capability listed" };
}

/** Derives a comparable Progression from a raider's per-boss detail.
 *
 * A raider records boss experience, not "6/8 M" - the structured pair lives on
 * the guild side. This counts how many bosses in `raidId` they have actually
 * killed at `difficulty` or above, which is the same unit the guild's own
 * currentBossesKilled is in, so the two become comparable.
 *
 * Progressed-but-not-killed deliberately does not count: progressionMatch
 * measures where you have finished, and bossExperienceMatch already gives
 * partial credit for progression on the specific boss that matters. */
export function progressionFromBossExperience(
  experience: readonly BossExperience[],
  raidId: string,
  difficulty: RaidDifficulty
): Progression {
  const wanted = DIFFICULTY_ORDER.indexOf(difficulty);
  const killed = new Set(
    experience
      .filter(
        (e) =>
          e.raidId === raidId &&
          DIFFICULTY_ORDER.indexOf(e.difficulty) >= wanted &&
          (e.state === "killed" || e.state === "farm")
      )
      .map((e) => e.bossId)
  );
  return { raidId, difficulty, bossesKilled: killed.size };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface RaiderApplicantProfile {
  preferredRole: string;
  offRoles: string[];
  /** Already UTC-shifted by the caller (see shiftToUtc). */
  availability: WeeklySlot[];
  languages: string[];
  preferredDifficulty: string;
  progression: Progression;
  bossExperience: readonly BossExperience[];
  attendanceExpectation: number | null;
  atmosphere: string | null;
}

export interface GuildTeamProfile {
  /** Raid nights, UTC-shifted. */
  availability: WeeklySlot[];
  languages: string[];
  difficulty: string;
  progression: Progression;
  attendanceRequirement: number | null;
  atmosphere: string | null;
  /** The role this application is aimed at, when it targets a position. */
  neededRole?: string | null;
  /** The boss the guild is currently working on, for the sharpest signal
   * available in raid recruiting. */
  currentBossId?: string | null;
}

/** Every dimension of a guild application, explained separately.
 *
 * Ordered the way a raid officer actually triages: can they make the nights,
 * are they at our progression point, do they know the boss we are stuck on -
 * then the softer fit. Same contract as explainApplication: a list, never a
 * score, and parse percentile is not an input. */
export function explainGuildApplication(
  raider: RaiderApplicantProfile,
  team: GuildTeamProfile
): MatchFacet[] {
  const facets: MatchFacet[] = [];

  facets.push(raidDayMatch(raider.availability, team.availability));
  facets.push(progressionMatch(raider.progression, team.progression));

  if (team.currentBossId && team.progression.raidId) {
    facets.push(
      bossExperienceMatch(
        raider.bossExperience,
        team.progression.raidId,
        team.currentBossId,
        team.difficulty as RaidDifficulty
      )
    );
  }

  facets.push(difficultyMatch(raider.preferredDifficulty, team.difficulty));
  facets.push(attendanceMatch(raider.attendanceExpectation, team.attendanceRequirement));

  // Language reuses the M+ implementation rather than restating it - the
  // question is identical on both sides of the app.
  facets.push(languageMatch(raider.languages, team.languages));

  if (team.neededRole) {
    const off = offRoleMatch(raider.offRoles, team.neededRole);
    if (off.level !== "none") facets.push(off);
  }

  const atmosphere = atmosphereMatch(raider.atmosphere, team.atmosphere);
  if (atmosphere.level !== "none") facets.push(atmosphere);

  return facets;
}
