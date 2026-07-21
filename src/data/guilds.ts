// Data access for guilds and their raid teams.
//
// A Guild is thin - it holds identity and culture. The RaidTeam under it is
// what actually recruits, expires and gets browsed, because one guild routinely
// runs a Mythic roster and a casual Heroic roster with entirely different
// requirements.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeExpiry } from "@/game/expiry";
import { guildDTO, raidTeamDTO, serializeJson } from "./recruitmentMappers";
import { browsableWhere, clampLimit, positionAcceptsSpec } from "./recruitmentShared";
import { blockedUserIds } from "./moderation";
import type {
  CreateGuildInput,
  CreateRaidTeamInput,
  GuildDTO,
  RaidPositionInput,
  RaidTeamDTO,
  RaidTeamFilters,
} from "./recruitmentDto";

const GUILD_SELECT = {
  id: true,
  name: true,
  region: true,
  country: true,
  realm: true,
  realmSlug: true,
  faction: true,
  languages: true,
} as const;

const TEAM_INCLUDE = { positions: true, guild: { select: GUILD_SELECT } } as const;

/** Slugified realm, matching how Character.realmSlug is stored elsewhere, so a
 * guild on "Twisting Nether" and a character on the same realm agree. */
function realmSlug(realm: string | null | undefined): string | null {
  if (!realm) return null;
  return realm.trim().toLowerCase().replace(/[\s']+/g, "-");
}

// ---------------------------------------------------------------------------
// Guild reads and writes
// ---------------------------------------------------------------------------

export async function getGuild(id: string): Promise<GuildDTO | null> {
  const row = await prisma.guild.findUnique({
    where: { id },
    include: { raidTeams: { include: TEAM_INCLUDE, orderBy: { createdAt: "asc" } } },
  });
  return row ? guildDTO(row) : null;
}

export async function listMyGuilds(userId: string): Promise<GuildDTO[]> {
  const rows = await prisma.guild.findMany({
    where: { ownerUserId: userId },
    include: { raidTeams: { include: TEAM_INCLUDE, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(guildDTO);
}

export async function createGuild(ownerUserId: string, input: CreateGuildInput): Promise<GuildDTO> {
  const row = await prisma.guild.create({
    data: {
      ownerUserId,
      name: input.name,
      region: input.region,
      country: input.country ?? null,
      realm: input.realm ?? null,
      realmSlug: realmSlug(input.realm),
      faction: input.faction ?? null,
      description: input.description ?? null,
      culture: input.culture ?? null,
      size: input.size ?? null,
      languages: serializeJson(input.languages),
      discordUrl: input.discordUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
    },
    include: { raidTeams: { include: TEAM_INCLUDE } },
  });
  return guildDTO(row);
}

export async function updateGuild(guildId: string, input: CreateGuildInput): Promise<GuildDTO> {
  const row = await prisma.guild.update({
    where: { id: guildId },
    data: {
      name: input.name,
      region: input.region,
      country: input.country ?? null,
      realm: input.realm ?? null,
      realmSlug: realmSlug(input.realm),
      faction: input.faction ?? null,
      description: input.description ?? null,
      culture: input.culture ?? null,
      size: input.size ?? null,
      languages: serializeJson(input.languages),
      discordUrl: input.discordUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
    },
    include: { raidTeams: { include: TEAM_INCLUDE, orderBy: { createdAt: "asc" } } },
  });
  return guildDTO(row);
}

/** Deleting a guild cascades to its raid teams at the DB level, but their
 * applications are not cascaded (targetId has no FK), so they are cleared
 * first - otherwise every team under this guild leaves orphan rows. */
export async function deleteGuild(guildId: string): Promise<void> {
  const teams = await prisma.raidTeam.findMany({ where: { guildId }, select: { id: true } });
  await prisma.$transaction([
    prisma.recruitmentApplication.deleteMany({
      where: { recruitmentType: "guild", targetId: { in: teams.map((t) => t.id) } },
    }),
    prisma.guild.delete({ where: { id: guildId } }),
  ]);
}

// ---------------------------------------------------------------------------
// Raid teams
// ---------------------------------------------------------------------------

export async function getRaidTeam(id: string): Promise<RaidTeamDTO | null> {
  const row = await prisma.raidTeam.findUnique({ where: { id }, include: TEAM_INCLUDE });
  return row ? raidTeamDTO(row) : null;
}

/** The Browse Guilds tab. Returns raid TEAMS rather than guilds, because a
 * raider is shopping for a roster with an opening, not for a guild name. */
export async function listRaidTeams(
  filters: RaidTeamFilters = {},
  now: Date = new Date()
): Promise<RaidTeamDTO[]> {
  const {
    region,
    languages,
    difficulty,
    role,
    specId,
    recruitmentType,
    ownerUserId,
    includeExpired,
    limit,
    viewerUserId,
  } = filters;

  // Blocking hides listings too, not only applications - see listMPlusPosts.
  // A raid team is owned transitively through its guild.
  const hidden = viewerUserId ? await blockedUserIds(viewerUserId) : new Set<string>();

  // Same AND-array reasoning as listMPlusPosts: several clauses target
  // `positions`, so one object literal would drop all but the last.
  const and: Prisma.RaidTeamWhereInput[] = [];
  if (difficulty) and.push({ difficulty });
  if (region) and.push({ guild: { region } });
  if (ownerUserId) and.push({ guild: { ownerUserId } });
  if (role) and.push({ positions: { some: { role, isFilled: false } } });
  if (recruitmentType) and.push({ positions: { some: { recruitmentType, isFilled: false } } });
  if (hidden.size) and.push({ guild: { ownerUserId: { notIn: [...hidden] } } });

  const rows = await prisma.raidTeam.findMany({
    where: {
      ...browsableWhere(now, includeExpired || !!ownerUserId),
      ...(and.length ? { AND: and } : {}),
    },
    include: TEAM_INCLUDE,
    orderBy: { refreshedAt: "desc" },
    take: clampLimit(limit),
  });

  let teams = rows.map(raidTeamDTO);

  // ---- in-memory filters for the JSON columns SQLite can't query ----
  if (languages?.length) {
    teams = teams.filter((t) => (t.guild?.languages ?? []).some((l) => languages.includes(l)));
  }
  if (specId) {
    teams = teams.filter((t) =>
      t.positions.some((p) => !p.isFilled && (!role || p.role === role) && positionAcceptsSpec(p, specId))
    );
  }
  return teams;
}

function raidPositionCreateData(p: RaidPositionInput) {
  return {
    role: p.role,
    preferredSpecIds: serializeJson(p.preferredSpecIds ?? []),
    acceptedSpecIds: serializeJson(p.acceptedSpecIds ?? []),
    recruitmentType: p.recruitmentType,
    priority: p.priority ?? 0,
    isFilled: p.isFilled ?? false,
  };
}

function teamScalarData(input: CreateRaidTeamInput) {
  return {
    name: input.name,
    difficulty: input.difficulty,
    currentProgression: input.currentProgression ?? null,
    currentRaidId: input.currentRaidId ?? null,
    currentBossesKilled: input.currentBossesKilled ?? null,
    previousProgression: input.previousProgression ?? null,
    availability: serializeJson(input.availability),
    timeZone: input.timeZone ?? null,
    voicePlatform: input.voicePlatform ?? null,
    attendanceRequirement: input.attendanceRequirement ?? null,
    trialDuration: input.trialDuration ?? null,
    benchPolicy: input.benchPolicy ?? null,
    lootPolicy: input.lootPolicy ?? null,
    expectations: input.expectations ?? null,
    requiredAddons: serializeJson(input.requiredAddons ?? []),
  };
}

export async function createRaidTeam(
  guildId: string,
  input: CreateRaidTeamInput,
  now: Date = new Date()
): Promise<RaidTeamDTO> {
  const row = await prisma.raidTeam.create({
    data: {
      guildId,
      ...teamScalarData(input),
      refreshedAt: now,
      expiresAt: computeExpiry(now, "guild"),
      positions: { create: (input.positions ?? []).map(raidPositionCreateData) },
    },
    include: TEAM_INCLUDE,
  });
  return raidTeamDTO(row);
}

/** Positions are replaced wholesale - the form always submits the full list,
 * same reasoning as updateMPlusPost. */
export async function updateRaidTeam(teamId: string, input: CreateRaidTeamInput): Promise<RaidTeamDTO> {
  const row = await prisma.$transaction(async (tx) => {
    await tx.raidRecruitmentPosition.deleteMany({ where: { raidTeamId: teamId } });
    return tx.raidTeam.update({
      where: { id: teamId },
      data: {
        ...teamScalarData(input),
        positions: { create: (input.positions ?? []).map(raidPositionCreateData) },
      },
      include: TEAM_INCLUDE,
    });
  });
  return raidTeamDTO(row);
}

/** Same orphan cleanup as deleteMPlusPost - RecruitmentApplication.targetId
 * has no FK, so its rows must go explicitly. */
export async function deleteRaidTeam(teamId: string): Promise<void> {
  await prisma.$transaction([
    prisma.recruitmentApplication.deleteMany({ where: { recruitmentType: "guild", targetId: teamId } }),
    prisma.raidTeam.delete({ where: { id: teamId } }),
  ]);
}

/** Guild listings additionally require confirming recruitment is still active,
 * which the UI asks for before calling this - the 30-day window is long enough
 * that a silent bump would keep dead rosters alive. */
export async function refreshRaidTeam(teamId: string, now: Date = new Date()): Promise<RaidTeamDTO> {
  // Revives an expired team - see the same note on refreshMPlusPost.
  const existing = await prisma.raidTeam.findUnique({ where: { id: teamId }, select: { status: true } });

  const row = await prisma.raidTeam.update({
    where: { id: teamId },
    data: {
      refreshedAt: now,
      expiresAt: computeExpiry(now, "guild"),
      ...(existing?.status === "expired" ? { status: "open" } : {}),
    },
    include: TEAM_INCLUDE,
  });
  return raidTeamDTO(row);
}

export async function setRaidTeamStatus(teamId: string, status: string): Promise<RaidTeamDTO> {
  const row = await prisma.raidTeam.update({
    where: { id: teamId },
    data: { status },
    include: TEAM_INCLUDE,
  });
  return raidTeamDTO(row);
}
