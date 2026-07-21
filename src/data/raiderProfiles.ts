// Data access for "raider looking for guild" profiles - the player side of the
// guild market.
//
// One row per character, so an account can advertise a Mythic-ready main and a
// Heroic alt with different availability without the two interfering.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeExpiry } from "@/game/expiry";
import { bossExperienceFromRaidKills, raiderProfileDTO, serializeJson } from "./recruitmentMappers";
import { CHARACTER_SELECT, browsableWhere, clampLimit } from "./recruitmentShared";
import { blockedUserIds } from "./moderation";
import type { CreateRaiderProfileInput, RaiderProfileDTO, RaiderProfileFilters } from "./recruitmentDto";

const PROFILE_INCLUDE = { character: { select: CHARACTER_SELECT } } as const;

export async function getRaiderProfile(id: string): Promise<RaiderProfileDTO | null> {
  const row = await prisma.raiderProfile.findUnique({ where: { id }, include: PROFILE_INCLUDE });
  return row ? raiderProfileDTO(row) : null;
}

export async function listRaiderProfiles(
  filters: RaiderProfileFilters = {},
  now: Date = new Date()
): Promise<RaiderProfileDTO[]> {
  const {
    region,
    languages,
    difficulty,
    role,
    atmosphere,
    trialAvailable,
    ownerUserId,
    includeExpired,
    limit,
    viewerUserId,
  } = filters;

  // Blocking hides listings too - see listMPlusPosts.
  const hidden = viewerUserId ? await blockedUserIds(viewerUserId) : new Set<string>();

  const and: Prisma.RaiderProfileWhereInput[] = [];
  if (region) and.push({ region });
  if (difficulty) and.push({ preferredDifficulty: difficulty });
  if (atmosphere) and.push({ atmosphere });
  if (trialAvailable !== undefined) and.push({ trialAvailable });
  // preferredRole is a real column; off-role capability lives in a JSON column
  // and so is matched in memory below, where an off-role raider still counts.
  if (role) and.push({ preferredRole: role });
  if (hidden.size) and.push({ ownerUserId: { notIn: [...hidden] } });

  const rows = await prisma.raiderProfile.findMany({
    where: {
      ...browsableWhere(now, includeExpired || !!ownerUserId),
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(and.length ? { AND: and } : {}),
    },
    include: PROFILE_INCLUDE,
    orderBy: { refreshedAt: "desc" },
    take: clampLimit(limit),
  });

  let profiles = rows.map(raiderProfileDTO);
  if (languages?.length) {
    profiles = profiles.filter((p) => p.languages.some((l) => languages.includes(l)));
  }
  return profiles;
}

export function listMyRaiderProfiles(userId: string): Promise<RaiderProfileDTO[]> {
  return listRaiderProfiles({ ownerUserId: userId, includeExpired: true });
}

function profileScalarData(input: CreateRaiderProfileInput) {
  return {
    primarySpecId: input.primarySpecId,
    alternateSpecIds: serializeJson(input.alternateSpecIds ?? []),
    preferredRole: input.preferredRole,
    offRoles: serializeJson(input.offRoles ?? []),
    title: input.title ?? null,
    introduction: input.introduction ?? null,
    region: input.region,
    country: input.country ?? null,
    languages: serializeJson(input.languages),
    timeZone: input.timeZone ?? null,
    availability: serializeJson(input.availability),
    preferredDifficulty: input.preferredDifficulty,
    currentProgression: input.currentProgression ?? null,
    previousProgression: input.previousProgression ?? null,
    attendanceExpectation: input.attendanceExpectation ?? null,
    voiceAvailable: input.voiceAvailable ?? true,
    transferWilling: input.transferWilling ?? false,
    factionFlexible: input.factionFlexible ?? false,
    atmosphere: input.atmosphere ?? null,
    competitiveLevel: input.competitiveLevel ?? null,
    trialAvailable: input.trialAvailable ?? true,
    showLogs: input.showLogs ?? false,
    showProfile: input.showProfile ?? true,
  };
}

/** When the caller supplies no boss experience, it is seeded from the kill
 * data already synced onto the character so a fresh profile has real
 * progression to show instead of an empty section. */
export async function createRaiderProfile(
  ownerUserId: string,
  input: CreateRaiderProfileInput,
  now: Date = new Date()
): Promise<RaiderProfileDTO> {
  let bossExperience = input.bossExperience ?? [];
  if (!bossExperience.length) {
    const char = await prisma.character.findUnique({
      where: { id: input.characterId },
      select: { raidKills: true },
    });
    if (char) bossExperience = bossExperienceFromRaidKills(char.raidKills);
  }

  const row = await prisma.raiderProfile.create({
    data: {
      ownerUserId,
      characterId: input.characterId,
      ...profileScalarData(input),
      bossExperience: serializeJson(bossExperience),
      refreshedAt: now,
      expiresAt: computeExpiry(now, "guild"),
    },
    include: PROFILE_INCLUDE,
  });
  return raiderProfileDTO(row);
}

export async function updateRaiderProfile(
  profileId: string,
  input: CreateRaiderProfileInput
): Promise<RaiderProfileDTO> {
  const row = await prisma.raiderProfile.update({
    where: { id: profileId },
    data: {
      ...profileScalarData(input),
      bossExperience: serializeJson(input.bossExperience ?? []),
    },
    include: PROFILE_INCLUDE,
  });
  return raiderProfileDTO(row);
}

export async function deleteRaiderProfile(profileId: string): Promise<void> {
  await prisma.raiderProfile.delete({ where: { id: profileId } });
}

export async function refreshRaiderProfile(
  profileId: string,
  now: Date = new Date()
): Promise<RaiderProfileDTO> {
  // Revives an expired profile - see the same note on refreshMPlusPost.
  const existing = await prisma.raiderProfile.findUnique({
    where: { id: profileId },
    select: { status: true },
  });

  const row = await prisma.raiderProfile.update({
    where: { id: profileId },
    data: {
      refreshedAt: now,
      expiresAt: computeExpiry(now, "guild"),
      ...(existing?.status === "expired" ? { status: "open" } : {}),
    },
    include: PROFILE_INCLUDE,
  });
  return raiderProfileDTO(row);
}

export async function setRaiderProfileStatus(
  profileId: string,
  status: string
): Promise<RaiderProfileDTO> {
  const row = await prisma.raiderProfile.update({
    where: { id: profileId },
    data: { status },
    include: PROFILE_INCLUDE,
  });
  return raiderProfileDTO(row);
}

/** Guards the one-profile-per-character rule before an insert, so the API can
 * answer with a clear 409 instead of surfacing a Prisma unique-constraint
 * error. */
export async function hasProfileForCharacter(userId: string, characterId: string): Promise<boolean> {
  const row = await prisma.raiderProfile.findFirst({
    where: { ownerUserId: userId, characterId },
    select: { id: true },
  });
  return !!row;
}
