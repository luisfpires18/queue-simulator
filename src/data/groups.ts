// Group (key/raid listing) CRUD + the one-active-commitment scheduling rule.
import { prisma } from "@/lib/prisma";
import { startsConflict } from "@/game/scheduling";
import { notify } from "@/server/notifications/dispatch";
import type { ActiveCommitmentDTO, CreateGroupInput, GroupDTO } from "./dto";
import { groupDTO } from "./mappers";

export async function createGroup(ownerUserId: string, input: CreateGroupInput) {
  const g = await prisma.group.create({
    data: {
      ownerUserId,
      title: input.title,
      description: input.description?.trim() || null,
      route: input.route?.trim() || null,
      kind: input.kind ?? "mplus",
      dungeonId: input.dungeonId ?? null,
      keyLevel: input.keyLevel ?? null,
      raidId: input.raidId ?? null,
      raidDifficulty: input.raidDifficulty ?? null,
      raidSize: input.raidSize ?? null,
      ownerRole: input.ownerRole,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      slots: JSON.stringify(input.slots),
      combos: JSON.stringify(input.combos ?? []),
      requirementType: input.requirementType ?? null,
      reqRating: input.reqRating ?? null,
      reqLevel: input.reqLevel ?? null,
      reqExtraCount: input.reqExtraCount ?? null,
      reqExtraLevel: input.reqExtraLevel ?? null,
      members: {
        create: {
          characterId: input.ownerCharacterId,
          role: input.ownerRole,
          specId: input.ownerSpecId,
          slot: 0,
        },
      },
    },
  });
  notify("group_created", g).catch((err) => console.error("notify group_created failed", err));
  return g;
}

export async function listGroups(): Promise<GroupDTO[]> {
  const groups = await prisma.group.findMany({
    where: { status: { not: "delisted" } },
    orderBy: { createdAt: "desc" },
    include: { members: { include: { character: true }, orderBy: { slot: "asc" } } },
  });
  return groups.map(groupDTO);
}

// Treats a delisted group as not-found — same as listGroups() filtering it
// off the board, so a stale tab (apply modal, edit-key page) can't act on it.
export async function getGroup(id: string): Promise<GroupDTO | null> {
  const g = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { character: true }, orderBy: { slot: "asc" } } },
  });
  return g && g.status !== "delisted" ? groupDTO(g) : null;
}

/** Updates a group's own fields plus the owner's slot-0 membership (their
 * character/spec may have changed since listing, if they've since switched
 * their navbar current-character selection). Returns false if the group
 * doesn't exist or isn't owned by this user — caller should 404/403. */
export async function updateGroup(id: string, ownerUserId: string, input: CreateGroupInput): Promise<boolean> {
  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing || existing.ownerUserId !== ownerUserId) return false;

  await prisma.$transaction([
    prisma.group.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description?.trim() || null,
        route: input.route?.trim() || null,
        dungeonId: input.dungeonId ?? null,
        keyLevel: input.keyLevel ?? null,
        raidId: input.raidId ?? null,
        raidDifficulty: input.raidDifficulty ?? null,
        raidSize: input.raidSize ?? null,
        ownerRole: input.ownerRole,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        slots: JSON.stringify(input.slots),
        combos: JSON.stringify(input.combos ?? []),
        requirementType: input.requirementType ?? null,
        reqRating: input.reqRating ?? null,
        reqLevel: input.reqLevel ?? null,
        reqExtraCount: input.reqExtraCount ?? null,
        reqExtraLevel: input.reqExtraLevel ?? null,
      },
    }),
    prisma.groupMember.upsert({
      where: { groupId_slot: { groupId: id, slot: 0 } },
      create: { groupId: id, characterId: input.ownerCharacterId, role: input.ownerRole, specId: input.ownerSpecId, slot: 0 },
      update: { characterId: input.ownerCharacterId, role: input.ownerRole, specId: input.ownerSpecId },
    }),
  ]);
  return true;
}

/** Soft-delete ("delist"): the row (and its members/applications) stays in
 * the DB for history, it just stops showing up anywhere (listGroups/getGroup
 * both filter out status "delisted"). Returns false if the group doesn't
 * exist or isn't owned by this user. */
export async function deleteGroup(id: string, ownerUserId: string): Promise<boolean> {
  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing || existing.ownerUserId !== ownerUserId) return false;
  await prisma.group.update({ where: { id }, data: { status: "delisted" } });
  return true;
}

// ---- Scheduling conflicts ----
// You can only be actively signed up for one key/raid at a time - see
// startsConflict in src/game/scheduling.ts. "Active" = you own the listing,
// or you have an accepted Application for it; there's no run-completion
// tracking in this app, so the only way out of a commitment is the owner
// delisting it (status "delisted"), same as everywhere else that filters on
// group status.

export async function getActiveCommitments(userId: string): Promise<ActiveCommitmentDTO[]> {
  const owned = await prisma.group.findMany({
    where: { ownerUserId: userId, status: { not: "delisted" } },
    select: { id: true, title: true, startsAt: true },
  });
  const acceptedApps = await prisma.application.findMany({
    where: { applicantUserId: userId, status: "accepted", group: { status: { not: "delisted" } } },
    select: { group: { select: { id: true, title: true, startsAt: true } } },
  });

  const seen = new Set<string>();
  const out: ActiveCommitmentDTO[] = [];
  for (const g of [...owned, ...acceptedApps.map((a) => a.group)]) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push({ groupId: g.id, title: g.title, startsAt: g.startsAt ? g.startsAt.toISOString() : null });
  }
  return out;
}

/** null = no conflict. Otherwise the specific commitment that collides, so
 * the caller can show a concrete message ("already in <title>"). Excludes
 * `excludeGroupId` so editing/accepting-into the same listing never
 * conflicts with itself. */
export async function findSchedulingConflict(
  userId: string,
  candidateStartsAt: string | null,
  excludeGroupId?: string
): Promise<ActiveCommitmentDTO | null> {
  const commitments = await getActiveCommitments(userId);
  return commitments.find((c) => c.groupId !== excludeGroupId && startsConflict(c.startsAt, candidateStartsAt)) ?? null;
}
