// Recruitment application lifecycle: apply, review, shortlist, trial, accept,
// decline, withdraw.
//
// Mirrors src/data/applications.ts (the live-board equivalent) closely, in
// particular its two hard-won lessons:
//   1. apply is transaction-wrapped, because two concurrent applies from one
//      user must refresh a single row rather than create two pending ones.
//   2. every gate is re-checked at ACCEPT time, not just apply time. An
//      applicant can hold many pending applications at once, and the post can
//      change underneath them, so accept is the authoritative moment.
import { prisma } from "@/lib/prisma";
import {
  canActorTransition,
  effectiveStatus,
  isTerminal,
  type Actor,
} from "@/game/applicationStatus";
import { statusAfterPositionChange } from "@/game/expiry";
import { isBlockedEither } from "./moderation";
import { CHARACTER_SELECT } from "./recruitmentShared";
import {
  parseStringArray,
  parseAvailability,
  parseBossExperience,
  serializeJson,
} from "./recruitmentMappers";
import { charDTO } from "./mappers";
import type { CharacterDTO } from "./dto";
import type { WeeklySlot } from "@/game/availability";
import type { BossExperience } from "@/game/recruitmentTypes";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface RecruitmentApplicationDTO {
  id: string;
  recruitmentType: string; // "mplus" | "guild"
  targetId: string;
  positionId: string | null;
  applicantUserId: string;
  characterId: string;
  specId: string;
  alternateSpecIds: string[];
  role: string;
  availability: WeeklySlot[];
  note: string | null;
  /** Present ONLY on the recruiter-facing shape. See the two mappers below. */
  recruiterNote?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  character: CharacterDTO;
  /** The applicant's published raider profile for this character, when they
   * have one. Present only on guild applications and only in the recruiter
   * view - it is what lets explainGuildApplication say anything about
   * progression, raid nights and boss experience. Everything in it was
   * already public on the Raiders board. */
  raiderProfile?: RaiderMatchProfile;
}

/** The slice of a RaiderProfile that guild matching actually reads. Kept
 * narrow rather than embedding the whole DTO: the recruiter view does not need
 * the raider's introduction or contact preferences, and not sending them keeps
 * this payload honest about its purpose. */
export interface RaiderMatchProfile {
  preferredRole: string;
  offRoles: string[];
  availability: WeeklySlot[];
  languages: string[];
  timeZone: string | null;
  preferredDifficulty: string;
  currentProgression: string | null;
  currentRaidId: string | null;
  currentBossesKilled: number | null;
  bossExperience: BossExperience[];
  attendanceExpectation: number | null;
  atmosphere: string | null;
}

export interface ApplyInput {
  recruitmentType: string;
  targetId: string;
  positionId?: string | null;
  characterId: string;
  specId: string;
  alternateSpecIds?: string[];
  role: string;
  availability?: WeeklySlot[];
  note?: string | null;
}

/** Why an apply was refused. Returned rather than thrown so routes can map
 * each to its own status code and a sentence the user can act on. */
export type ApplyFailure =
  | "target_not_found"
  | "target_closed"
  | "own_post"
  | "character_not_owned"
  | "blocked";

export type ApplyResult =
  | { ok: true; application: RecruitmentApplicationDTO }
  | { ok: false; reason: ApplyFailure };

type Row = {
  id: string;
  recruitmentType: string;
  targetId: string;
  positionId: string | null;
  applicantUserId: string;
  characterId: string;
  specId: string;
  alternateSpecIds: string;
  role: string;
  availability: string;
  note: string | null;
  recruiterNote: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  character: Parameters<typeof charDTO>[0];
};

/** Shared shape. `status` is passed through effectiveStatus so a row nobody
 * touched for 30 days reads as expired without a write having happened. */
function baseDTO(a: Row): Omit<RecruitmentApplicationDTO, "recruiterNote"> {
  return {
    id: a.id,
    recruitmentType: a.recruitmentType,
    targetId: a.targetId,
    positionId: a.positionId,
    applicantUserId: a.applicantUserId,
    characterId: a.characterId,
    specId: a.specId,
    alternateSpecIds: parseStringArray(a.alternateSpecIds),
    role: a.role,
    availability: parseAvailability(a.availability),
    note: a.note,
    status: effectiveStatus({ status: a.status, updatedAt: a.updatedAt }),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    character: charDTO(a.character),
  };
}

/** Applicant-facing shape. recruiterNote is omitted HERE, in the mapper,
 * rather than at each call site - a route cannot leak it by forgetting. */
export function applicantFacingDTO(a: Row): RecruitmentApplicationDTO {
  return baseDTO(a);
}

/** Recruiter-facing shape, the only one carrying the private note. */
export function recruiterFacingDTO(a: Row): RecruitmentApplicationDTO {
  return { ...baseDTO(a), recruiterNote: a.recruiterNote };
}

const APPLICATION_INCLUDE = { character: { select: CHARACTER_SELECT } } as const;

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

/** `targetId` addresses one of two tables depending on recruitmentType (see
 * the schema note), so every read of a target goes through here. Returns the
 * owning user id and whether the target is still accepting applications. */
async function loadTarget(
  recruitmentType: string,
  targetId: string
): Promise<{ ownerUserId: string; status: string; expiresAt: Date; title: string } | null> {
  if (recruitmentType === "guild") {
    const team = await prisma.raidTeam.findUnique({
      where: { id: targetId },
      select: { status: true, expiresAt: true, name: true, guild: { select: { ownerUserId: true, name: true } } },
    });
    if (!team) return null;
    return {
      ownerUserId: team.guild.ownerUserId,
      status: team.status,
      expiresAt: team.expiresAt,
      title: `${team.guild.name} - ${team.name}`,
    };
  }

  const post = await prisma.mPlusRecruitmentPost.findUnique({
    where: { id: targetId },
    select: { ownerUserId: true, status: true, expiresAt: true, title: true, teamName: true },
  });
  if (!post) return null;
  return {
    ownerUserId: post.ownerUserId,
    status: post.status,
    expiresAt: post.expiresAt,
    title: post.teamName || post.title,
  };
}

/** Public wrapper - routes need the owner id to authorize recruiter actions. */
export async function targetOwner(recruitmentType: string, targetId: string): Promise<string | null> {
  return (await loadTarget(recruitmentType, targetId))?.ownerUserId ?? null;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/** Applying again while a pending application already exists refreshes it in
 * place rather than piling up duplicates - same rule as the live board's
 * createApplication. A settled (declined/withdrawn) application does not block
 * a fresh one, so someone can re-apply after their situation changes.
 *
 * The transaction closes the find->refresh/create TOCTOU window: two
 * concurrent applies from one user must touch one row, not create two. */
export async function createApplication(applicantUserId: string, input: ApplyInput): Promise<ApplyResult> {
  const target = await loadTarget(input.recruitmentType, input.targetId);
  if (!target) return { ok: false, reason: "target_not_found" };

  if (target.ownerUserId === applicantUserId) return { ok: false, reason: "own_post" };
  if (target.status !== "open" || target.expiresAt <= new Date()) {
    return { ok: false, reason: "target_closed" };
  }

  const owned = await prisma.character.findFirst({
    where: { id: input.characterId, userId: applicantUserId },
    select: { id: true },
  });
  if (!owned) return { ok: false, reason: "character_not_owned" };

  // Symmetric block check - see isBlockedEither. Deliberately the same refusal
  // either way round: telling an applicant "you have been blocked" would leak
  // the block, so the route maps this to a neutral message.
  if (await isBlockedEither(applicantUserId, target.ownerUserId)) {
    return { ok: false, reason: "blocked" };
  }

  const note = input.note?.trim() || null;

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.recruitmentApplication.findFirst({
      where: {
        recruitmentType: input.recruitmentType,
        targetId: input.targetId,
        applicantUserId,
        // Only a LIVE application is refreshed. A declined one stays as
        // history and the new attempt becomes its own row.
        status: { notIn: ["accepted", "declined", "withdrawn", "expired"] },
      },
    });

    const data = {
      positionId: input.positionId ?? null,
      characterId: input.characterId,
      specId: input.specId,
      alternateSpecIds: serializeJson(input.alternateSpecIds ?? []),
      role: input.role,
      availability: serializeJson(input.availability ?? []),
      note,
    };

    return existing
      ? tx.recruitmentApplication.update({
          where: { id: existing.id },
          data,
          include: APPLICATION_INCLUDE,
        })
      : tx.recruitmentApplication.create({
          data: {
            recruitmentType: input.recruitmentType,
            targetId: input.targetId,
            applicantUserId,
            status: "pending",
            ...data,
          },
          include: APPLICATION_INCLUDE,
        });
  });

  return { ok: true, application: applicantFacingDTO(row) };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Recruiter view. Owner-gated by returning an empty list rather than
 * throwing, matching listPendingApplications in src/data/applications.ts -
 * this backs a UI list, and a 500 would be the wrong shape for "not yours". */
export async function listApplicationsForTarget(
  recruitmentType: string,
  targetId: string,
  requesterUserId: string,
  opts: { status?: string; includeSettled?: boolean } = {}
): Promise<RecruitmentApplicationDTO[]> {
  const target = await loadTarget(recruitmentType, targetId);
  if (!target || target.ownerUserId !== requesterUserId) return [];

  const rows = await prisma.recruitmentApplication.findMany({
    where: {
      recruitmentType,
      targetId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.includeSettled
        ? {}
        : { status: { notIn: ["declined", "withdrawn", "expired"] } }),
    },
    include: APPLICATION_INCLUDE,
    // Deliberately NOT ordered by rating or any performance field. The caller
    // groups by compatibility bucket and orders within it via fairOrder; this
    // is just a stable base order.
    orderBy: { createdAt: "asc" },
  });

  const dtos = rows.map(recruiterFacingDTO);
  // Guild applications need the raider's published profile to be explainable
  // at all - progression, raid nights and boss experience live there, not on
  // the application. One batched query rather than one per applicant.
  return recruitmentType === "guild" ? attachRaiderProfiles(dtos) : dtos;
}

async function attachRaiderProfiles(
  applications: RecruitmentApplicationDTO[]
): Promise<RecruitmentApplicationDTO[]> {
  if (!applications.length) return applications;

  const profiles = await prisma.raiderProfile.findMany({
    where: { characterId: { in: applications.map((a) => a.characterId) } },
    select: {
      characterId: true,
      ownerUserId: true,
      preferredRole: true,
      offRoles: true,
      availability: true,
      languages: true,
      timeZone: true,
      preferredDifficulty: true,
      currentProgression: true,
      previousProgression: true,
      bossExperience: true,
      attendanceExpectation: true,
      atmosphere: true,
    },
  });

  // Keyed by character AND owner: a RaiderProfile is unique per
  // (ownerUserId, characterId), and matching on character alone would attach a
  // profile to the wrong person if a character row were ever reassigned.
  const byKey = new Map(profiles.map((p) => [`${p.ownerUserId}:${p.characterId}`, p]));

  return applications.map((a) => {
    const p = byKey.get(`${a.applicantUserId}:${a.characterId}`);
    if (!p) return a;
    return {
      ...a,
      raiderProfile: {
        preferredRole: p.preferredRole,
        offRoles: parseStringArray(p.offRoles),
        availability: parseAvailability(p.availability),
        languages: parseStringArray(p.languages),
        timeZone: p.timeZone,
        preferredDifficulty: p.preferredDifficulty,
        currentProgression: p.currentProgression,
        // RaiderProfile stores progression as free text plus the structured
        // pair on the TEAM side; the raider's own structured anchor is derived
        // from their boss experience below.
        currentRaidId: null,
        currentBossesKilled: null,
        bossExperience: parseBossExperience(p.bossExperience),
        attendanceExpectation: p.attendanceExpectation,
        atmosphere: p.atmosphere,
      },
    };
  });
}

/** The applicant's own applications. Uses the applicant-facing mapper, so the
 * recruiter's private note is structurally absent. */
export async function listMyApplications(
  applicantUserId: string,
  opts: { recruitmentType?: string } = {}
): Promise<RecruitmentApplicationDTO[]> {
  const rows = await prisma.recruitmentApplication.findMany({
    where: {
      applicantUserId,
      ...(opts.recruitmentType ? { recruitmentType: opts.recruitmentType } : {}),
    },
    include: APPLICATION_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(applicantFacingDTO);
}

/** The caller's own live application to one target, so an Apply button can
 * show its state instead of re-offering to apply. */
export async function getMyApplication(
  recruitmentType: string,
  targetId: string,
  applicantUserId: string
): Promise<RecruitmentApplicationDTO | null> {
  const row = await prisma.recruitmentApplication.findFirst({
    where: { recruitmentType, targetId, applicantUserId },
    include: APPLICATION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return row ? applicantFacingDTO(row) : null;
}

/** Open-application counts per target, for badging the owner's My Recruitment
 * rows in one query rather than one per post. */
export async function countOpenApplicationsByTarget(
  recruitmentType: string,
  targetIds: string[]
): Promise<Record<string, number>> {
  if (!targetIds.length) return {};
  const rows = await prisma.recruitmentApplication.groupBy({
    by: ["targetId"],
    where: {
      recruitmentType,
      targetId: { in: targetIds },
      status: { notIn: ["accepted", "declined", "withdrawn", "expired"] },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.targetId, r._count._all]));
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export type TransitionFailure =
  | "not_found"
  | "not_authorized"
  | "illegal_transition"
  | "position_taken";

export type TransitionResult =
  | { ok: true; application: RecruitmentApplicationDTO; autoClosed: boolean }
  | { ok: false; reason: TransitionFailure };

/** The one entry point for every status change.
 *
 * Determines the actor from the row itself rather than trusting the caller,
 * then defers to canActorTransition - so "can an applicant accept themselves"
 * is answered by the tested state machine, not by an if here. */
export async function setApplicationStatus(
  applicationId: string,
  actorUserId: string,
  nextStatus: string
): Promise<TransitionResult> {
  const app = await prisma.recruitmentApplication.findUnique({
    where: { id: applicationId },
    include: APPLICATION_INCLUDE,
  });
  if (!app) return { ok: false, reason: "not_found" };

  const target = await loadTarget(app.recruitmentType, app.targetId);
  if (!target) return { ok: false, reason: "not_found" };

  const isApplicant = app.applicantUserId === actorUserId;
  const isRecruiter = target.ownerUserId === actorUserId;
  if (!isApplicant && !isRecruiter) return { ok: false, reason: "not_authorized" };

  const actor: Actor = isApplicant ? "applicant" : "recruiter";

  // Read the CURRENT status through effectiveStatus so a long-stale
  // application cannot be revived by a late click.
  const current = effectiveStatus({ status: app.status, updatedAt: app.updatedAt });
  if (isTerminal(current)) return { ok: false, reason: "illegal_transition" };
  if (!canActorTransition(current, nextStatus, app.recruitmentType, actor)) {
    return { ok: false, reason: "illegal_transition" };
  }

  if (nextStatus === "accepted") return acceptApplication(app.id);

  const updated = await prisma.recruitmentApplication.update({
    where: { id: applicationId },
    data: { status: nextStatus },
    include: APPLICATION_INCLUDE,
  });
  return {
    ok: true,
    application: isRecruiter ? recruiterFacingDTO(updated) : applicantFacingDTO(updated),
    autoClosed: false,
  };
}

/** Accepting is the transition with side effects, so it gets its own
 * transaction: mark accepted, put the character on the roster, close the
 * position, and auto-close the post if that was the last opening.
 *
 * This is the step that finally makes team rosters real - up to now a post
 * could only list characters its own owner held. */
async function acceptApplication(applicationId: string): Promise<TransitionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.recruitmentApplication.findUnique({ where: { id: applicationId } });
    if (!app) return { ok: false as const, reason: "not_found" as const };

    await tx.recruitmentApplication.update({
      where: { id: applicationId },
      data: { status: "accepted" },
    });

    let autoClosed = false;

    if (app.recruitmentType === "mplus") {
      // Roster insert. upsert rather than create: the same character may have
      // been on the post already (e.g. re-accepted after leaving), and the
      // @@unique([postId, characterId]) would otherwise throw.
      await tx.mPlusRecruitmentCharacter.upsert({
        where: { postId_characterId: { postId: app.targetId, characterId: app.characterId } },
        create: {
          postId: app.targetId,
          characterId: app.characterId,
          primarySpecId: app.specId,
          alternateSpecIds: app.alternateSpecIds,
          preferredRole: app.role,
          isCurrentMember: true,
          teamRole: "member",
        },
        update: { isCurrentMember: true, primarySpecId: app.specId, preferredRole: app.role },
      });

      if (app.positionId) {
        await tx.mPlusRecruitmentPosition.updateMany({
          where: { id: app.positionId, postId: app.targetId },
          data: { isFilled: true },
        });
      }

      const post = await tx.mPlusRecruitmentPost.findUnique({
        where: { id: app.targetId },
        select: { status: true, positions: { select: { isFilled: true } } },
      });
      if (post) {
        const next = statusAfterPositionChange(post.status, post.positions);
        if (next !== post.status) {
          await tx.mPlusRecruitmentPost.update({ where: { id: app.targetId }, data: { status: next } });
          autoClosed = next === "filled";
        }
      }
    } else {
      // Guild side: no roster table (guild rosters stay descriptive this
      // phase), so accepting only closes the position.
      if (app.positionId) {
        await tx.raidRecruitmentPosition.updateMany({
          where: { id: app.positionId, raidTeamId: app.targetId },
          data: { isFilled: true },
        });
      }
    }

    return { ok: true as const, autoClosed };
  });

  if (!result.ok) return result;

  const updated = await prisma.recruitmentApplication.findUnique({
    where: { id: applicationId },
    include: APPLICATION_INCLUDE,
  });
  return { ok: true, application: recruiterFacingDTO(updated!), autoClosed: result.autoClosed };
}

/** Applicant-initiated. Routed through setApplicationStatus so the same actor
 * rules apply - a recruiter cannot withdraw on someone's behalf. */
export function withdrawApplication(applicationId: string, actorUserId: string): Promise<TransitionResult> {
  return setApplicationStatus(applicationId, actorUserId, "withdrawn");
}

/** Recruiter-only private note. Never reaches an applicant-facing DTO. */
export async function setRecruiterNote(
  applicationId: string,
  actorUserId: string,
  note: string | null
): Promise<boolean> {
  const app = await prisma.recruitmentApplication.findUnique({
    where: { id: applicationId },
    select: { recruitmentType: true, targetId: true },
  });
  if (!app) return false;

  const target = await loadTarget(app.recruitmentType, app.targetId);
  if (!target || target.ownerUserId !== actorUserId) return false;

  await prisma.recruitmentApplication.update({
    where: { id: applicationId },
    data: { recruiterNote: note?.trim() || null },
  });
  return true;
}

/** `targetId` has no FK (it addresses two tables), so deleting a post must
 * delete its applications explicitly. Called from deleteMPlusPost and
 * deleteRaidTeam. */
export async function deleteApplicationsForTarget(
  recruitmentType: string,
  targetId: string
): Promise<void> {
  await prisma.recruitmentApplication.deleteMany({ where: { recruitmentType, targetId } });
}
