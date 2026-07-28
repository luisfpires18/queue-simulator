// Team (persistent roster) CRUD. Mirrors src/data/groups.ts, minus the
// scheduling/expiry rules - a team has no start time and never goes stale.
import { prisma } from "@/lib/prisma";
import { rebuildOpenSlots, teamStatusForSlots } from "@/game/teamRoster";
import type { CreateTeamInput, TeamActionResult, TeamDTO, TeamSummaryDTO } from "./dto";
import { parseSlots, teamDTO } from "./mappers";

// Scoped to exactly what teamDTO reads (see src/data/mappers.ts) instead of
// full Character rows - a team board pulls this for every member of every
// recruiting team.
const MEMBER_INCLUDE = {
  members: {
    select: {
      userId: true, characterId: true, role: true, specId: true, joinedAt: true,
      character: { select: { name: true, realm: true, realmSlug: true, region: true, classId: true, ilvl: true, rating: true } },
    },
    orderBy: { joinedAt: "asc" },
  },
} as const;

// Defensive cap, not real pagination - the board shows every open team with
// no UI-side limit today, so this only guards against a pathological
// recruiting-team count turning one board load into an unbounded pull.
const LIST_TEAMS_CAP = 200;

/** Fails when the owner is already on a team - TeamMember.userId is unique. */
export async function createTeam(ownerUserId: string, input: CreateTeamInput): Promise<TeamDTO> {
  const t = await prisma.team.create({
    data: {
      ownerUserId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      iconSlug: input.iconSlug,
      language: input.language ?? null,
      voiceChat: input.voiceChat?.trim() || null,
      slots: JSON.stringify(input.slots),
      requirementType: input.requirementType ?? null,
      reqRating: input.reqRating ?? null,
      reqLevel: input.reqLevel ?? null,
      reqExtraCount: input.reqExtraCount ?? null,
      reqExtraLevel: input.reqExtraLevel ?? null,
      members: {
        create: {
          userId: ownerUserId,
          characterId: input.ownerCharacterId,
          role: input.ownerRole,
          specId: input.ownerSpecId,
        },
      },
    },
    include: MEMBER_INCLUDE,
  });
  return teamDTO(t);
}

/** The board: only teams actually recruiting. A full roster unlists itself
 * (status "full") rather than sitting on the board advertising no spots. */
export async function listTeams(): Promise<TeamDTO[]> {
  const teams = await prisma.team.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: MEMBER_INCLUDE,
    take: LIST_TEAMS_CAP,
  });
  return teams.map(teamDTO);
}

/** A delisted team reads as not-found, so a stale tab can't act on it. */
export async function getTeam(id: string): Promise<TeamDTO | null> {
  const t = await prisma.team.findUnique({ where: { id }, include: MEMBER_INCLUDE });
  return t && t.status !== "delisted" ? teamDTO(t) : null;
}

/** The team this user belongs to (owned or joined), or null. */
export async function getMyTeam(userId: string): Promise<TeamDTO | null> {
  const membership = await prisma.teamMember.findUnique({
    where: { userId },
    include: { team: { include: MEMBER_INCLUDE } },
  });
  if (!membership || membership.team.status === "delisted") return null;
  return teamDTO(membership.team);
}

/** The compact form the profile status chip renders from. */
export async function getTeamSummary(userId: string): Promise<TeamSummaryDTO | null> {
  const membership = await prisma.teamMember.findUnique({
    where: { userId },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  if (!membership || membership.team.status === "delisted") return null;
  const { team } = membership;
  return {
    id: team.id,
    name: team.name,
    iconSlug: team.iconSlug,
    memberCount: team._count.members,
  };
}

/** Same-shaped summaries for many users at once, for list/board rendering. */
export async function getTeamSummariesByUser(userIds: string[]): Promise<Map<string, TeamSummaryDTO>> {
  const out = new Map<string, TeamSummaryDTO>();
  if (userIds.length === 0) return out;
  const rows = await prisma.teamMember.findMany({
    where: { userId: { in: userIds } },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  for (const r of rows) {
    if (r.team.status === "delisted") continue;
    out.set(r.userId, {
      id: r.team.id, name: r.team.name, iconSlug: r.team.iconSlug,
      memberCount: r.team._count.members,
    });
  }
  return out;
}

/** Updates the team plus the owner's own membership row (their character or
 * spec may have changed since listing). False when not found or not owned. */
export async function updateTeam(id: string, ownerUserId: string, input: CreateTeamInput): Promise<boolean> {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing || existing.ownerUserId !== ownerUserId) return false;

  await prisma.$transaction([
    prisma.team.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        iconSlug: input.iconSlug,
        language: input.language ?? null,
        voiceChat: input.voiceChat?.trim() || null,
        slots: JSON.stringify(input.slots),
        // Keeps listing state in step with the roster - an owner editing a
        // full team back down to an open spot relists it, and vice versa.
        // Never resurrects a team the owner deliberately delisted.
        ...(existing.status === "delisted" ? {} : { status: teamStatusForSlots(input.slots) }),
        requirementType: input.requirementType ?? null,
        reqRating: input.reqRating ?? null,
        reqLevel: input.reqLevel ?? null,
        reqExtraCount: input.reqExtraCount ?? null,
        reqExtraLevel: input.reqExtraLevel ?? null,
      },
    }),
    prisma.teamMember.update({
      where: { userId: ownerUserId },
      data: { characterId: input.ownerCharacterId, role: input.ownerRole, specId: input.ownerSpecId },
    }),
  ]);
  return true;
}

/** Soft-delete ("delist"). Membership rows are removed too, so everyone's
 * profile falls back to "No Team" instead of pointing at a hidden listing. */
export async function deleteTeam(id: string, ownerUserId: string): Promise<boolean> {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing || existing.ownerUserId !== ownerUserId) return false;
  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { teamId: id } }),
    prisma.team.update({ where: { id }, data: { status: "delisted" } }),
  ]);
  return true;
}

/**
 * Removes one member. A member can remove themselves (leave); the owner can
 * remove anyone else (kick). The owner cannot leave their own team - the
 * listing would be left ownerless, so they delist it instead.
 */
export async function removeTeamMember(teamId: string, targetUserId: string, actingUserId: string): Promise<TeamActionResult> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.status === "delisted") return { ok: false, reason: "not_found" };

  const isSelf = targetUserId === actingUserId;
  if (!isSelf && team.ownerUserId !== actingUserId) return { ok: false, reason: "not_allowed" };
  if (targetUserId === team.ownerUserId) return { ok: false, reason: "owner_must_delist" };

  const membership = await prisma.teamMember.findUnique({ where: { userId: targetUserId } });
  if (!membership || membership.teamId !== teamId) return { ok: false, reason: "not_found" };

  // Their spot goes back on the board. Accepting someone trims a slot, so
  // without this the team would keep the vacancy invisible - and a full team
  // is now unlisted, which would strand it there permanently.
  const remaining = await prisma.teamMember.findMany({
    where: { teamId, userId: { not: targetUserId } },
    select: { role: true },
  });
  const slots = rebuildOpenSlots(remaining.map((m) => m.role), parseSlots(team.slots));

  await prisma.$transaction([
    prisma.teamMember.delete({ where: { userId: targetUserId } }),
    prisma.team.update({
      where: { id: teamId },
      data: { slots: JSON.stringify(slots), status: teamStatusForSlots(slots) },
    }),
  ]);
  return { ok: true };
}
