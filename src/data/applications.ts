// Application lifecycle: apply, review (owner), accept, decline.
import { prisma } from "@/lib/prisma";
import { rankScoreFor } from "@/game/rating";
import type { Role } from "@/game/classes";
import { characterDungeonAchievement, meetsResilientRequirement, meetsCustomRequirement } from "@/game/achievements";
import { notifyUser } from "@/server/notifications/dispatch";
import { minRatingFailure } from "@/server/guards";
import { runMatchPass } from "@/server/soloQueue/matchRunner";
import type {
  AcceptApplicationResult,
  ApplicationDTO,
  DeclineResult,
  ApplicationWithRatingDTO,
  ApplyInput,
  MyApplicationStateDTO,
  SpecTrackDTO,
} from "./dto";
import { applicationDTO, parseBestRuns, parseSlots } from "./mappers";
import { resolveDeclineReason } from "./declineReasons";
import { declineRecordData, getLastDeclinesByListing } from "./declineRecords";
import { mergeCounts } from "./counts";
import { findSchedulingConflict } from "./groups";
import { getSpecTracks } from "./characters";

// Scoped to exactly what applicationDTO reads (see src/data/mappers.ts)
// instead of full Character rows via `include: { character: true }`.
const APPLICATION_FOR_DTO_SELECT = {
  id: true, groupId: true, applicantUserId: true, characterId: true,
  role: true, specId: true, note: true, route: true, status: true, source: true, createdAt: true,
  character: {
    select: { name: true, realm: true, realmSlug: true, region: true, classId: true, ilvl: true, raidKills: true },
  },
} as const;

/** Applying again while a pending application already exists from this user
 * refreshes it in place (new character/spec/note) rather than piling up
 * duplicates. A past accepted/declined application doesn't block a new one. */
export async function createApplication(applicantUserId: string, input: ApplyInput): Promise<ApplicationDTO> {
  const note = input.note?.trim() || null;
  const route = input.route?.trim() || null;
  // Transaction closes the find->refresh/create TOCTOU window: two concurrent
  // applies from the same user must refresh one row, not create two pending ones.
  const a = await prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { groupId: input.groupId, applicantUserId, status: "pending" },
    });
    return existing
      ? tx.application.update({
          where: { id: existing.id },
          data: { characterId: input.characterId, specId: input.specId, role: input.role, note, route },
          select: APPLICATION_FOR_DTO_SELECT,
        })
      : tx.application.create({
          data: {
            groupId: input.groupId, applicantUserId, characterId: input.characterId,
            specId: input.specId, role: input.role, note, route, status: "pending",
          },
          select: APPLICATION_FOR_DTO_SELECT,
        });
  });
  return applicationDTO(a);
}

/** The calling user's own (latest) application to this group, so the Apply
 * button can show its outcome instead of re-offering to apply. */
export async function getMyApplication(groupId: string, applicantUserId: string): Promise<ApplicationDTO | null> {
  const a = await prisma.application.findFirst({
    where: { groupId, applicantUserId },
    orderBy: { createdAt: "desc" },
    select: APPLICATION_FOR_DTO_SELECT,
  });
  return a ? applicationDTO(a) : null;
}

/** The viewer's latest application + decline count for each of the given
 * groups, in one query - used to seed board cards server-side so the first
 * paint shows the real button state ("Applied - Pending"/"Accepted") instead
 * of flashing "Apply" until each card's own fetch lands. Per-group shape is
 * identical to GET /api/groups/[id]/my-application. */
export async function getMyApplicationsByGroup(
  applicantUserId: string,
  groupIds: string[]
): Promise<Record<string, MyApplicationStateDTO>> {
  const out: Record<string, MyApplicationStateDTO> = {};
  if (groupIds.length === 0) return out;
  const [rows, lastDeclines] = await Promise.all([
    prisma.application.findMany({
      where: { applicantUserId, groupId: { in: groupIds } },
      orderBy: { createdAt: "desc" },
      select: APPLICATION_FOR_DTO_SELECT,
    }),
    getLastDeclinesByListing(applicantUserId, groupIds),
  ]);
  for (const a of rows) {
    const entry = (out[a.groupId] ??= { application: null, declinedCount: 0, lastDecline: null });
    if (!entry.application) entry.application = applicationDTO(a); // newest-first: first row per group is the latest
    if (a.status === "declined") entry.declinedCount++;
  }
  // Only surfaced while the latest application is actually a decline -
  // re-applying replaces the state, so a stale reason must not linger.
  for (const [groupId, entry] of Object.entries(out)) {
    if (entry.application?.status === "declined") entry.lastDecline = lastDeclines[groupId] ?? null;
  }
  return out;
}

/**
 * Pending-application counts for the given groups, in one query.
 *
 * Seeds the owner's "Pending Requests (N)" badge into the server render.
 * Without it the chip renders nothing at all until its own client fetch
 * lands, and those fetches are the last to fire on a board page - which is
 * exactly why the badge appeared to arrive late.
 *
 * Callers must pass only groups the viewer owns: the count is owner-only
 * information and this function does not re-check ownership.
 */
export async function getPendingCountsByGroup(groupIds: string[]): Promise<Record<string, number>> {
  if (groupIds.length === 0) return {};
  const rows = await prisma.application.groupBy({
    by: ["groupId"],
    where: { groupId: { in: groupIds }, status: "pending" },
    _count: { _all: true },
  });
  return mergeCounts(groupIds, rows.map((r) => ({ id: r.groupId, count: r._count._all })));
}

/** A declined application isn't deleted - re-applying (see createApplication)
 * inserts a fresh row rather than reviving the old one - so declines for a
 * given group/applicant just pile up and are cheap to count directly. */
export async function countDeclinedApplications(groupId: string, applicantUserId: string): Promise<number> {
  return prisma.application.count({ where: { groupId, applicantUserId, status: "declined" } });
}

/** null when the group has no requirement set (nothing to advise on). */
function meetsGroupRequirement(
  group: { requirementType: string | null; reqRating: number | null; reqLevel: number | null; reqExtraCount: number | null; reqExtraLevel: number | null },
  specTracks: SpecTrackDTO[],
  appliedScore: number
): boolean | null {
  if (group.requirementType === "rating") {
    return group.reqRating != null ? appliedScore >= group.reqRating : null;
  }
  if (group.requirementType === "resilient") {
    return group.reqLevel != null ? meetsResilientRequirement(characterDungeonAchievement(specTracks), group.reqLevel) : null;
  }
  if (group.requirementType === "custom") {
    return group.reqLevel != null && group.reqExtraCount != null && group.reqExtraLevel != null
      ? meetsCustomRequirement(characterDungeonAchievement(specTracks), group.reqLevel, group.reqExtraCount, group.reqExtraLevel)
      : null;
  }
  return null;
}

const EMPTY_ROLE_COUNTS: Record<Role, number> = { TANK: 0, HEALER: 0, DPS: 0 };

// See the PENDING_APPLICATIONS_CAP usage below - the ranking score can't be
// computed in SQL (see rankScoreFor), so pagination is a JS slice over this
// set; this just bounds how large that set can get in one query.
const PENDING_APPLICATIONS_CAP = 500;

/** Pending applications for a group, filtered to one role tab and paginated,
 * sorted highest-rating-first — owner-only (empty result if the caller
 * doesn't own it, rather than throwing, since this backs a UI list).
 * Ranking needs a JS-computed key (the higher of applied-spec vs. main-spec
 * score, from two different tables — see rankScoreFor), so pagination is a
 * JS slice over the full sorted set rather than SQL skip/take; realistic
 * pending-queue sizes make this cheap. `role: null` returns every role
 * (unfiltered), still counted/ranked the same way. */
export async function listPendingApplications(
  groupId: string,
  ownerUserId: string,
  role: Role | null,
  page = 1,
  pageSize = 5
): Promise<{ applications: ApplicationWithRatingDTO[]; total: number; countsByRole: Record<Role, number> }> {
  // Fetched together: the pending rows don't depend on the ownership check,
  // so serialising them just added a round trip to the common (owner) path.
  // A non-owner wastes one read, which is the rarer case by far.
  const [group, allPending] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    // PENDING_APPLICATIONS_CAP is a defensive cap, not real pagination - a
    // pathological pending-queue size shouldn't turn one badge click into an
    // unbounded pull.
    prisma.application.findMany({
      where: { groupId, status: "pending" },
      select: APPLICATION_FOR_DTO_SELECT,
      take: PENDING_APPLICATIONS_CAP,
    }),
  ]);
  if (!group || group.ownerUserId !== ownerUserId) {
    return { applications: [], total: 0, countsByRole: { ...EMPTY_ROLE_COUNTS } };
  }

  const countsByRole = { ...EMPTY_ROLE_COUNTS };
  for (const a of allPending) countsByRole[a.role as Role]++;

  const roleFiltered = role ? allPending.filter((a) => a.role === role) : allPending;

  const characterIds = [...new Set(roleFiltered.map((a) => a.characterId))];
  const tracks = characterIds.length
    ? await prisma.characterSpecTrack.findMany({ where: { characterId: { in: characterIds } } })
    : [];
  const tracksByChar = new Map<string, SpecTrackDTO[]>();
  for (const t of tracks) {
    const list = tracksByChar.get(t.characterId) ?? [];
    list.push({ ...t, bestRuns: parseBestRuns(t.bestRuns) });
    tracksByChar.set(t.characterId, list);
  }

  const ranked = roleFiltered
    .map((a) => {
      const specTracks = tracksByChar.get(a.characterId) ?? [];
      const { score, rankedByMain } = rankScoreFor(specTracks, a.specId);
      const meetsRequirement = meetsGroupRequirement(group, specTracks, score);
      return { ...applicationDTO(a), specTracks, rankedByMain, meetsRequirement, _rankScore: score };
    })
    .sort((a, b) => b._rankScore - a._rankScore);

  const total = ranked.length;
  const applications = ranked
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ _rankScore, ...rest }) => rest);

  return { applications, total, countsByRole };
}

/** Accepts a pending application: inserts the applicant as a new GroupMember
 * (first free slot number) and trims the matching open-slot entry (by role)
 * from Group.slots, in one transaction. Fails with reason "not_found" if the
 * caller isn't the group's owner or the application isn't pending, "conflict"
 * if the applicant already has an active commitment (owns or was accepted
 * into another non-delisted listing) within an hour of this one - see
 * findSchedulingConflict - or "below_requirement" if the group has a hard
 * minimum-rating requirement the applicant no longer meets (re-checked here
 * in case the owner raised it after the application was submitted). These
 * races are real: an applicant can have several pending applications out at
 * once (manual apply isn't limited to one at a time, unlike Solo Queue), so
 * this is the authoritative gate, not just a check at apply-time. */
export async function acceptApplication(applicationId: string, ownerUserId: string): Promise<AcceptApplicationResult> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || app.status !== "pending") return { ok: false, reason: "not_found" };
  const group = await prisma.group.findUnique({
    where: { id: app.groupId },
    include: { members: { select: { slot: true } } },
  });
  if (!group || group.ownerUserId !== ownerUserId) return { ok: false, reason: "not_found" };

  const conflict = await findSchedulingConflict(app.applicantUserId, group.startsAt ? group.startsAt.toISOString() : null, group.id);
  if (conflict) return { ok: false, reason: "conflict", conflictTitle: conflict.title };

  // Re-checked here too (POST /api/groups/[id]/apply already gates this at
  // apply time) - covers the edit-after-apply race where the owner raises
  // the requirement after this application was already submitted.
  if (group.requirementType === "rating" && group.reqRating != null) {
    const failed = minRatingFailure(group, await getSpecTracks(app.characterId), app.specId);
    if (failed) return { ok: false, reason: "below_requirement", requiredRating: failed.required };
  }

  const openSlots = parseSlots(group.slots);
  const matchIdx = openSlots.findIndex((s) => s.role === app.role);
  const remainingSlots = matchIdx === -1 ? openSlots : openSlots.filter((_, i) => i !== matchIdx);
  const nextSlot = group.members.reduce((max, m) => Math.max(max, m.slot), -1) + 1;

  await prisma.$transaction([
    prisma.groupMember.create({
      data: { groupId: group.id, characterId: app.characterId, role: app.role, specId: app.specId, slot: nextSlot },
    }),
    prisma.group.update({ where: { id: group.id }, data: { slots: JSON.stringify(remainingSlots) } }),
    prisma.application.update({ where: { id: applicationId }, data: { status: "accepted" } }),
    // Queue-sourced: close out the Solo Queue entry this proposal came from.
    prisma.soloQueueEntry.updateMany({
      where: { activeApplicationId: applicationId },
      data: { status: "matched", activeApplicationId: null },
    }),
  ]);

  notifyUser(app.applicantUserId, {
    title: "Application accepted",
    body: `You're in for "${group.title}"!`,
    url: "/runs",
  }).catch((err) => console.error("notifyUser accept failed", err));
  return { ok: true };
}

/** Returns false if the caller isn't the group's owner or the application
 * isn't pending. Queue-sourced proposals (source "queue") stay silent on
 * decline — the applicant never applied themselves, so there's nothing for
 * them to be told; instead the Solo Queue entry is freed up to be retried
 * against another group (see runSoloQueueMatch). Manual applications keep
 * notifying the applicant as before. */
export async function declineApplication(
  applicationId: string,
  ownerUserId: string,
  reasonId: string,
  note?: string | null
): Promise<DeclineResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { group: true, character: { select: { name: true, realm: true, classId: true } } },
  });
  if (!app || app.status !== "pending") return { ok: false, reason: "not_found" };
  if (app.group.ownerUserId !== ownerUserId) return { ok: false, reason: "not_found" };

  const reason = await resolveDeclineReason(reasonId);
  if (!reason) return { ok: false, reason: "invalid_reason" };

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: "declined" } }),
    prisma.soloQueueEntry.updateMany({
      where: { activeApplicationId: applicationId },
      data: { activeApplicationId: null },
    }),
    // Written in the same transaction: a decline that isn't recorded is
    // exactly the state this feature exists to remove.
    prisma.declineRecord.create({
      data: declineRecordData({
        applicantUserId: app.applicantUserId,
        declinedByUserId: ownerUserId,
        listingKind: app.group.kind,
        listingTitle: app.group.title,
        listingId: app.group.id,
        reasonId: reason.id,
        reasonLabel: reason.label,
        note,
        characterName: app.character.name,
        characterRealm: app.character.realm,
        classId: app.character.classId,
        role: app.role,
        specId: app.specId,
      }),
    }),
  ]);

  if (app.source === "queue") {
    runMatchPass().catch((err) => console.error("runSoloQueueMatch after decline failed", err));
  } else {
    notifyUser(app.applicantUserId, {
      title: "Application declined",
      body: `"${app.group.title}": ${reason.label}`,
      url: "/profile",
    }).catch((err) => console.error("notifyUser decline failed", err));
  }
  return { ok: true };
}
