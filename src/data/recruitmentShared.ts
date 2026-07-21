// Bits shared by the three recruitment data modules (mplusRecruitment,
// guilds, raiderProfiles). Kept separate so each module stays about its own
// table.
import { prisma } from "@/lib/prisma";

/** Ownership check for a recruitment row. Routes turn a false into the
 * canonical 403 - same shape as findOwnedCharacter's usage in the existing
 * group routes. */
export async function ownsMPlusPost(userId: string, postId: string): Promise<boolean> {
  const row = await prisma.mPlusRecruitmentPost.findFirst({
    where: { id: postId, ownerUserId: userId },
    select: { id: true },
  });
  return !!row;
}

export async function ownsGuild(userId: string, guildId: string): Promise<boolean> {
  const row = await prisma.guild.findFirst({ where: { id: guildId, ownerUserId: userId }, select: { id: true } });
  return !!row;
}

/** Raid teams are owned transitively through their guild - there is no
 * ownerUserId on RaidTeam itself, since a team never outlives its guild. */
export async function ownsRaidTeam(userId: string, raidTeamId: string): Promise<boolean> {
  const row = await prisma.raidTeam.findFirst({
    where: { id: raidTeamId, guild: { ownerUserId: userId } },
    select: { id: true },
  });
  return !!row;
}

export async function ownsRaiderProfile(userId: string, profileId: string): Promise<boolean> {
  const row = await prisma.raiderProfile.findFirst({
    where: { id: profileId, ownerUserId: userId },
    select: { id: true },
  });
  return !!row;
}

/** The character columns every recruitment DTO needs. Matches what charDTO in
 * src/data/mappers.ts reads, so a select built from this always satisfies it. */
export const CHARACTER_SELECT = {
  id: true,
  name: true,
  realm: true,
  realmSlug: true,
  region: true,
  classId: true,
  specId: true,
  level: true,
  ilvl: true,
  rating: true,
  faction: true,
  isMain: true,
  wclZone: true,
  bucket: true,
  sortOrder: true,
  raidKills: true,
} as const;

/** Default page size for browse queries. Generous enough that Phase 1 needs no
 * pagination UI, bounded so a query can't run away. */
export const DEFAULT_LIMIT = 60;
export const MAX_LIMIT = 200;

export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

/** SQLite has no JSON operators, so a filter on "does this post have an open
 * DPS position accepting Fury Warrior" can't be a WHERE clause on the JSON
 * spec columns. Role is a real column and IS filtered in SQL; the spec half is
 * applied in memory after the fetch. Fine at this scale (a region's open
 * listings are hundreds of rows, not millions) and honest about it - moving to
 * Postgres later turns this into a real jsonb query.
 *
 * An empty acceptedSpecIds AND empty preferredSpecIds means "any spec in this
 * role", which must pass rather than fail. */
export function positionAcceptsSpec(
  position: { preferredSpecIds: string[]; acceptedSpecIds: string[] },
  specId: string
): boolean {
  if (!position.preferredSpecIds.length && !position.acceptedSpecIds.length) return true;
  return position.preferredSpecIds.includes(specId) || position.acceptedSpecIds.includes(specId);
}

/** Shared "is this listing publicly browsable right now" predicate, expressed
 * as a Prisma where-fragment. Owner views pass includeExpired to bypass it, so
 * a paused or expired post is still manageable by the person who made it. */
export function browsableWhere(now: Date, includeExpired?: boolean) {
  return includeExpired ? {} : { status: "open", expiresAt: { gt: now } };
}
