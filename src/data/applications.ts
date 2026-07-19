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
  ApplicationWithRatingDTO,
  ApplyInput,
  MyApplicationStateDTO,
  SpecTrackDTO,
} from "./dto";
import { applicationDTO, parseBestRuns, parseSlots } from "./mappers";
import { findSchedulingConflict } from "./groups";
import { getSpecTracks } from "./characters";

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
          include: { character: true },
        })
      : tx.application.create({
          data: {
            groupId: input.groupId, applicantUserId, characterId: input.characterId,
            specId: input.specId, role: input.role, note, route, status: "pending",
          },
          include: { character: true },
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
    include: { character: true },
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
  const rows = await prisma.application.findMany({
    where: { applicantUserId, groupId: { in: groupIds } },
    orderBy: { createdAt: "desc" },
    include: { character: true },
  });
  for (const a of rows) {
    const entry = (out[a.groupId] ??= { application: null, declinedCount: 0 });
    if (!entry.application) entry.application = applicationDTO(a); // newest-first: first row per group is the latest
    if (a.status === "declined") entry.declinedCount++;
  }
  return out;
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
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.ownerUserId !== ownerUserId) {
    return { applications: [], total: 0, countsByRole: { ...EMPTY_ROLE_COUNTS } };
  }

  const allPending = await prisma.application.findMany({
    where: { groupId, status: "pending" },
    include: { character: true },
  });

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
export async function declineApplication(applicationId: string, ownerUserId: string): Promise<boolean> {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { group: true } });
  if (!app || app.status !== "pending") return false;
  if (app.group.ownerUserId !== ownerUserId) return false;

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: "declined" } }),
    prisma.soloQueueEntry.updateMany({
      where: { activeApplicationId: applicationId },
      data: { activeApplicationId: null },
    }),
  ]);

  if (app.source === "queue") {
    runMatchPass().catch((err) => console.error("runSoloQueueMatch after decline failed", err));
  } else {
    notifyUser(app.applicantUserId, {
      title: "Application declined",
      body: `Your application for "${app.group.title}" was declined.`,
      url: "/runs",
    }).catch((err) => console.error("notifyUser decline failed", err));
  }
  return true;
}
