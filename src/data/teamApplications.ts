// Team application lifecycle: apply, review (owner), accept, decline.
// Structurally the same as src/data/applications.ts; the differences are that
// there is no solo-queue/scheduling interaction and that accepting is gated
// by the one-team-per-user rule.
import { prisma } from "@/lib/prisma";
import { rankScoreFor } from "@/game/rating";
import type { Role } from "@/game/classes";
import { characterDungeonAchievement, meetsResilientRequirement, meetsCustomRequirement } from "@/game/achievements";
import { notifyUser } from "@/server/notifications/dispatch";
import { minRatingFailure } from "@/server/guards";
import { teamStatusForSlots } from "@/game/teamRoster";
import type {
  AcceptTeamApplicationResult,
  ApplyToTeamInput,
  DeclineResult,
  MyTeamApplicationStateDTO,
  OpenSlot,
  SpecTrackDTO,
  TeamApplicationDTO,
  TeamApplicationWithRatingDTO,
} from "./dto";
import { parseBestRuns, parseSlots, teamApplicationDTO } from "./mappers";
import { mergeCounts } from "./counts";
import { resolveDeclineReason } from "./declineReasons";
import { countDeclinesByListing, declineRecordData, getLastDeclinesByListing } from "./declineRecords";
import { getSpecTracks } from "./characters";

// Scoped to exactly what teamApplicationDTO reads (see src/data/mappers.ts)
// instead of full Character rows via `include: { character: true }`.
const TEAM_APPLICATION_FOR_DTO_SELECT = {
  id: true, teamId: true, applicantUserId: true, characterId: true,
  role: true, specId: true, note: true, status: true, createdAt: true,
  character: {
    select: { name: true, realm: true, realmSlug: true, region: true, classId: true, ilvl: true, raidKills: true },
  },
} as const;

/** Re-applying refreshes the existing row in place (TeamApplication is unique
 * per team+applicant), including reviving a previously declined one. */
export async function applyToTeam(applicantUserId: string, input: ApplyToTeamInput): Promise<TeamApplicationDTO> {
  const note = input.note?.trim() || null;
  const a = await prisma.teamApplication.upsert({
    where: { teamId_applicantUserId: { teamId: input.teamId, applicantUserId } },
    create: {
      teamId: input.teamId, applicantUserId, characterId: input.characterId,
      specId: input.specId, role: input.role, note, status: "pending",
    },
    update: {
      characterId: input.characterId, specId: input.specId, role: input.role, note, status: "pending",
    },
    select: TEAM_APPLICATION_FOR_DTO_SELECT,
  });
  return teamApplicationDTO(a);
}

export async function getMyTeamApplication(teamId: string, applicantUserId: string): Promise<TeamApplicationDTO | null> {
  const a = await prisma.teamApplication.findUnique({
    where: { teamId_applicantUserId: { teamId, applicantUserId } },
    select: TEAM_APPLICATION_FOR_DTO_SELECT,
  });
  return a ? teamApplicationDTO(a) : null;
}

/** The viewer's application state for each of the given teams, in one query -
 * seeds board cards server-side so the first paint shows the real button. */
export async function getMyTeamApplicationsByTeam(
  applicantUserId: string,
  teamIds: string[]
): Promise<Record<string, MyTeamApplicationStateDTO>> {
  const out: Record<string, MyTeamApplicationStateDTO> = {};
  if (teamIds.length === 0) return out;
  const [rows, lastDeclines, declineCounts] = await Promise.all([
    prisma.teamApplication.findMany({
      where: { applicantUserId, teamId: { in: teamIds } },
      select: TEAM_APPLICATION_FOR_DTO_SELECT,
    }),
    getLastDeclinesByListing(applicantUserId, teamIds),
    countDeclinesByListing(applicantUserId, "team", teamIds),
  ]);
  for (const a of rows) {
    out[a.teamId] = {
      application: teamApplicationDTO(a),
      // Re-applying upserts this row back to "pending", so the reason is
      // only shown while the application still reads as declined.
      lastDecline: a.status === "declined" ? lastDeclines[a.teamId] ?? null : null,
      declinedCount: declineCounts[a.teamId] ?? 0,
    };
  }
  return out;
}

/** Pending-application counts for the given teams, in one query - seeds the
 * owner's badge into the server render. Owner-only information; callers pass
 * only teams the viewer owns. See getPendingCountsByGroup. */
export async function getPendingCountsByTeam(teamIds: string[]): Promise<Record<string, number>> {
  if (teamIds.length === 0) return {};
  const rows = await prisma.teamApplication.groupBy({
    by: ["teamId"],
    where: { teamId: { in: teamIds }, status: "pending" },
    _count: { _all: true },
  });
  return mergeCounts(teamIds, rows.map((r) => ({ id: r.teamId, count: r._count._all })));
}

/** null when the team has no requirement set (nothing to advise on). */
function meetsTeamRequirement(
  team: { requirementType: string | null; reqRating: number | null; reqLevel: number | null; reqExtraCount: number | null; reqExtraLevel: number | null },
  specTracks: SpecTrackDTO[],
  appliedScore: number
): boolean | null {
  if (team.requirementType === "rating") {
    return team.reqRating != null ? appliedScore >= team.reqRating : null;
  }
  if (team.requirementType === "resilient") {
    return team.reqLevel != null ? meetsResilientRequirement(characterDungeonAchievement(specTracks), team.reqLevel) : null;
  }
  if (team.requirementType === "custom") {
    return team.reqLevel != null && team.reqExtraCount != null && team.reqExtraLevel != null
      ? meetsCustomRequirement(characterDungeonAchievement(specTracks), team.reqLevel, team.reqExtraCount, team.reqExtraLevel)
      : null;
  }
  return null;
}

const EMPTY_ROLE_COUNTS: Record<Role, number> = { TANK: 0, HEALER: 0, DPS: 0 };

// See listPendingTeamApplications - the ranking score can't be computed in
// SQL (see rankScoreFor), so pagination is a JS slice over this set; this
// just bounds how large that set can get in one query.
const PENDING_TEAM_APPLICATIONS_CAP = 500;

/** Pending applications for a team, one role tab at a time, ranked
 * highest-score-first. Owner-only; a non-owner gets an empty result rather
 * than an error, since this backs a UI list. */
export async function listPendingTeamApplications(
  teamId: string,
  ownerUserId: string,
  role: Role | null,
  page = 1,
  pageSize = 5
): Promise<{ applications: TeamApplicationWithRatingDTO[]; total: number; countsByRole: Record<Role, number> }> {
  // Fetched together - see the same note in listPendingApplications.
  const [team, allPending] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.teamApplication.findMany({
      where: { teamId, status: "pending" },
      select: TEAM_APPLICATION_FOR_DTO_SELECT,
      take: PENDING_TEAM_APPLICATIONS_CAP,
    }),
  ]);
  if (!team || team.ownerUserId !== ownerUserId) {
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
      const meetsRequirement = meetsTeamRequirement(team, specTracks, score);
      return { ...teamApplicationDTO(a), specTracks, rankedByMain, meetsRequirement, _rankScore: score };
    })
    .sort((a, b) => b._rankScore - a._rankScore);

  const total = ranked.length;
  const applications = ranked
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ _rankScore, ...rest }) => rest);

  return { applications, total, countsByRole };
}

/** Drops the first open slot matching `role`. Pure, so the trimming rule is
 * unit-testable without a database. Slots with no match are left untouched -
 * a team can accept someone it wasn't explicitly recruiting for. */
export function trimSlotForRole(slots: OpenSlot[], role: string): OpenSlot[] {
  const idx = slots.findIndex((s) => s.role === role);
  return idx === -1 ? slots : slots.filter((_, i) => i !== idx);
}

/**
 * Accepts a pending application: inserts a TeamMember and trims the matching
 * open slot, in one transaction. Fails with "already_in_team" when the
 * applicant joined some other team between applying and being accepted (the
 * @unique on TeamMember.userId is the real enforcement - this just turns it
 * into a typed result instead of a Prisma throw), and "below_requirement"
 * when the owner raised a hard rating requirement in the meantime.
 */
export async function acceptTeamApplication(applicationId: string, ownerUserId: string): Promise<AcceptTeamApplicationResult> {
  const app = await prisma.teamApplication.findUnique({ where: { id: applicationId } });
  if (!app || app.status !== "pending") return { ok: false, reason: "not_found" };

  const team = await prisma.team.findUnique({ where: { id: app.teamId } });
  if (!team || team.status === "delisted" || team.ownerUserId !== ownerUserId) return { ok: false, reason: "not_found" };

  const existingMembership = await prisma.teamMember.findUnique({ where: { userId: app.applicantUserId } });
  if (existingMembership) return { ok: false, reason: "already_in_team" };

  if (team.requirementType === "rating" && team.reqRating != null) {
    const failed = minRatingFailure(team, await getSpecTracks(app.characterId), app.specId);
    if (failed) return { ok: false, reason: "below_requirement", requiredRating: failed.required };
  }

  const remainingSlots = trimSlotForRole(parseSlots(team.slots), app.role);

  await prisma.$transaction([
    prisma.teamMember.create({
      data: { teamId: team.id, userId: app.applicantUserId, characterId: app.characterId, role: app.role, specId: app.specId },
    }),
    prisma.team.update({
      where: { id: team.id },
      // Taking the last spot unlists the team - it has nothing left to
      // recruit. It stays a real team on everyone's profile (see
      // teamStatusForSlots); only the board drops it.
      data: { slots: JSON.stringify(remainingSlots), status: teamStatusForSlots(remainingSlots) },
    }),
    prisma.teamApplication.update({ where: { id: applicationId }, data: { status: "accepted" } }),
  ]);

  notifyUser(app.applicantUserId, {
    title: "Team application accepted",
    body: `You joined "${team.name}".`,
    url: "/teams",
  }).catch((err) => console.error("notifyUser team accept failed", err));
  return { ok: true };
}

/** Fails when the caller doesn't own the team, the application isn't pending,
 * or the picked reason is unknown/archived. */
export async function declineTeamApplication(
  applicationId: string,
  ownerUserId: string,
  reasonId: string,
  note?: string | null
): Promise<DeclineResult> {
  const app = await prisma.teamApplication.findUnique({
    where: { id: applicationId },
    include: { team: true, character: { select: { name: true, realm: true, classId: true } } },
  });
  if (!app || app.status !== "pending") return { ok: false, reason: "not_found" };
  if (app.team.ownerUserId !== ownerUserId) return { ok: false, reason: "not_found" };

  const reason = await resolveDeclineReason(reasonId);
  if (!reason) return { ok: false, reason: "invalid_reason" };

  await prisma.$transaction([
    prisma.teamApplication.update({ where: { id: applicationId }, data: { status: "declined" } }),
    // Same transaction as the status change - see declineApplication. It
    // matters more here: re-applying UPSERTS this row, so the application
    // itself stops being evidence the decline ever happened.
    prisma.declineRecord.create({
      data: declineRecordData({
        applicantUserId: app.applicantUserId,
        declinedByUserId: ownerUserId,
        listingKind: "team",
        listingTitle: app.team.name,
        listingId: app.team.id,
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

  notifyUser(app.applicantUserId, {
    title: "Team application declined",
    body: `"${app.team.name}": ${reason.label}`,
    url: "/profile",
  }).catch((err) => console.error("notifyUser team decline failed", err));
  return { ok: true };
}
