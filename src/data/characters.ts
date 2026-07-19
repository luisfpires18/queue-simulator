// Character roster + per-spec track persistence. Verbatim moves from the old
// src/data/source.ts, except getPublicCharacters which batches its spec-track
// lookup (was one query per character).
import { prisma } from "@/lib/prisma";
import type { BlizzardChar } from "./blizzard";
import type { RaidKillDifficulty } from "@/game/raidSeason";
import type {
  CharacterDTO,
  CharacterRatingSummaryDTO,
  DungeonBestRun,
  RaidKillDTO,
  RosterCharacterDTO,
  SpecTrackDTO,
} from "./dto";
import { charDTO, parseBestRuns, parseRaidKills } from "./mappers";

const BUCKET_ORDER: Record<string, number> = { main: 0, alt: 1, hidden: 2 };

export async function getUserCharacters(userId: string): Promise<CharacterDTO[]> {
  const chars = await prisma.character.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { level: "desc" }, { name: "asc" }],
  });
  return chars.map(charDTO).sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || a.sortOrder - b.sortOrder);
}

/** Public roster for another player's profile page — hidden characters excluded. */
export async function getPublicCharacters(
  realmSlug: string,
  name: string
): Promise<{ battletag: string | null; country: string | null; memberSince: string; characters: RosterCharacterDTO[] } | null> {
  const owner = await prisma.character.findFirst({ where: { realmSlug, name }, include: { user: true } });
  if (!owner) return null;
  const chars = await prisma.character.findMany({
    where: { userId: owner.userId, bucket: { not: "hidden" } },
    orderBy: [{ sortOrder: "asc" }, { level: "desc" }, { name: "asc" }],
  });
  const sorted = chars.map(charDTO).sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || a.sortOrder - b.sortOrder);
  const tracksByChar = await getSpecTracksByCharacter(sorted.map((c) => c.id));
  const characters = sorted.map((c) => ({ ...c, specTracks: tracksByChar.get(c.id) ?? [] }));
  return {
    battletag: owner.user.showBattletag ? owner.user.battletag : null,
    country: owner.user.country,
    memberSince: owner.user.createdAt.toISOString(),
    characters,
  };
}

/** Rating/best-runs for one character, all tracked specs — the "click a
 * filled slot on a key" lookup. Not owner-gated: a character actively
 * listing a key or applying to one is already implicitly visible (same
 * privacy bar as the public profile page), unlike the private roster board. */
export async function getCharacterRatingSummary(characterId: string): Promise<CharacterRatingSummaryDTO | null> {
  const char = await prisma.character.findUnique({ where: { id: characterId }, include: { user: { select: { country: true } } } });
  if (!char) return null;
  return {
    name: char.name, realm: char.realm, realmSlug: char.realmSlug, region: char.region, classId: char.classId,
    ilvl: char.ilvl,
    specTracks: await getSpecTracks(characterId),
    raidKills: parseRaidKills(char.raidKills),
    country: char.user.country,
  };
}

/** Persist a raid-kill sync (see /api/characters/[id]/raid-kills/sync) -
 * merges with whatever's already stored, keeping the HIGHER difficulty per
 * boss if a re-sync ever sees a lower one (WCL pagination can miss a kill
 * that was already recorded from an earlier, more complete sync). */
export async function setCharacterRaidKills(characterId: string, kills: RaidKillDTO[]) {
  // Read-merge-write in a transaction so two overlapping syncs can't drop
  // each other's kills.
  await prisma.$transaction(async (tx) => {
    const char = await tx.character.findUnique({ where: { id: characterId } });
    if (!char) return;
    const existing = parseRaidKills(char.raidKills);
    const rank: Record<RaidKillDifficulty, number> = { lfr: 0, normal: 1, heroic: 2, mythic: 3 };
    const byBoss = new Map<string, RaidKillDTO>();
    for (const k of [...existing, ...kills]) {
      const key = `${k.raidId}:${k.bossId}`;
      const prev = byBoss.get(key);
      if (!prev || rank[k.difficulty] > rank[prev.difficulty]) byBoss.set(key, k);
    }
    await tx.character.update({
      where: { id: characterId },
      data: { raidKills: JSON.stringify([...byBoss.values()]) },
    });
  });
}

export async function upsertCharacters(userId: string, chars: BlizzardChar[]) {
  // Only import max-level playable characters with a mapped class.
  const usable = chars.filter((c) => c.classId && c.level >= 70);
  for (const c of usable) {
    await prisma.character.upsert({
      where: { userId_realm_name: { userId, realm: c.realm, name: c.name } },
      create: {
        userId, name: c.name, realm: c.realm, realmSlug: c.realmSlug, region: c.region,
        classId: c.classId!, level: c.level, faction: c.faction,
      },
      update: { level: c.level, faction: c.faction, classId: c.classId!, realmSlug: c.realmSlug },
    });
  }
  return usable.length;
}

export async function setMain(userId: string, characterId: string) {
  await prisma.character.updateMany({ where: { userId }, data: { isMain: false } });
  const char = await prisma.character.findUnique({ where: { id: characterId } });
  // The star only makes sense on a character already in the "main" bucket.
  if (char && char.bucket !== "main") await setCharacterBucket(userId, characterId, "main");
  await prisma.character.update({ where: { id: characterId }, data: { isMain: true } });
}

export async function updateCharacterSummary(
  characterId: string,
  data: { specId?: string | null; ilvl?: number | null }
) {
  return prisma.character.update({ where: { id: characterId }, data });
}

/** Move a character into a bucket (main/alt/hidden), appended to the end of it. */
export async function setCharacterBucket(userId: string, characterId: string, bucket: string) {
  const max = await prisma.character.aggregate({
    where: { userId, bucket },
    _max: { sortOrder: true },
  });
  const data: { bucket: string; sortOrder: number; isMain?: boolean } = {
    bucket,
    sortOrder: (max._max.sortOrder ?? -1) + 1,
  };
  if (bucket !== "main") data.isMain = false; // the star can't survive leaving the main bucket
  return prisma.character.update({ where: { id: characterId }, data });
}

/** Persist a bucket's full drag order in one shot. */
export async function reorderBucket(userId: string, bucket: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.character.updateMany({ where: { id, userId, bucket }, data: { sortOrder: i } })
    )
  );
}

export async function setCharacterWclZone(characterId: string, wclZone: string | null) {
  return prisma.character.update({ where: { id: characterId }, data: { wclZone } });
}

/** Store a fresh Blizzard rating fetch: overall on Character, per-spec on
 * CharacterSpecTrack (score + this season's per-dungeon best runs). */
export async function setCharacterRating(
  characterId: string,
  overallRating: number | null,
  specScores: { specId: string; score: number; role: string }[],
  bestRunsBySpec: Record<string, DungeonBestRun[]> = {},
  ilvl: number | null = null
) {
  await prisma.$transaction([
    prisma.character.update({
      where: { id: characterId },
      data: {
        rating: overallRating, ratingUpdatedAt: new Date(),
        ...(ilvl != null ? { ilvl } : {}),
      },
    }),
    ...specScores.map((s) => {
      const bestRuns = JSON.stringify(bestRunsBySpec[s.specId] ?? []);
      return prisma.characterSpecTrack.upsert({
        where: { characterId_specId: { characterId, specId: s.specId } },
        create: { characterId, specId: s.specId, role: s.role, bnetScore: s.score, bestRuns },
        update: { bnetScore: s.score, bestRuns },
      });
    }),
  ]);
}

/**
 * Store a fresh Warcraft Logs dungeon-score fetch (public API, no per-user
 * login needed — see fetchOverview). Unlike Blizzard's rating, WCL derives
 * this per spec directly from logged parses, so it can cover a spec
 * Blizzard's own best-run-per-dungeon data never surfaces.
 */
export async function setSpecPoints(
  characterId: string,
  specScores: { specId: string; role: string; points: number }[]
) {
  await prisma.$transaction(
    specScores.map((s) =>
      prisma.characterSpecTrack.upsert({
        where: { characterId_specId: { characterId, specId: s.specId } },
        create: { characterId, specId: s.specId, role: s.role, points: s.points },
        update: { points: s.points },
      })
    )
  );
}

// ---- Spec tracking (Warcraft Logs parse analysis) ----
export async function getSpecTracks(characterId: string): Promise<SpecTrackDTO[]> {
  const tracks = await prisma.characterSpecTrack.findMany({ where: { characterId } });
  return tracks.map((t) => ({ ...t, bestRuns: parseBestRuns(t.bestRuns) }));
}

/** Spec tracks for many characters in one query, grouped by character. */
export async function getSpecTracksByCharacter(characterIds: string[]): Promise<Map<string, SpecTrackDTO[]>> {
  const byChar = new Map<string, SpecTrackDTO[]>();
  if (characterIds.length === 0) return byChar;
  const tracks = await prisma.characterSpecTrack.findMany({ where: { characterId: { in: characterIds } } });
  for (const t of tracks) {
    const list = byChar.get(t.characterId) ?? [];
    list.push({ ...t, bestRuns: parseBestRuns(t.bestRuns) });
    byChar.set(t.characterId, list);
  }
  return byChar;
}

/** Replace the full set of tracked specs for a character (mirrors wcl's roster
 * upsert). Upserts each wanted spec (preserving its isMain/bnetScore rather
 * than wiping them) and only deletes rows for specs no longer wanted. */
export async function setSpecTracks(
  characterId: string,
  specs: { specId: string; role: string; points: number | null }[]
): Promise<SpecTrackDTO[]> {
  const existing = await prisma.characterSpecTrack.findMany({ where: { characterId } });
  const existingBySpec = new Map(existing.map((e) => [e.specId, e]));
  const wantedIds = specs.map((s) => s.specId);

  await prisma.$transaction([
    ...specs.map((s) =>
      prisma.characterSpecTrack.upsert({
        where: { characterId_specId: { characterId, specId: s.specId } },
        create: { characterId, specId: s.specId, role: s.role, points: s.points, isMain: existingBySpec.get(s.specId)?.isMain ?? false },
        update: { role: s.role, points: s.points },
      })
    ),
    prisma.characterSpecTrack.deleteMany({ where: { characterId, specId: { notIn: wantedIds } } }),
  ]);
  return getSpecTracks(characterId);
}

/** Mark one spec as this character's curated main — clears isMain on every
 * other spec of the character in the same transaction. Which specs count as
 * "offspecs" isn't stored at all: any spec with a real rating > 0 already
 * implies that, computed on read (see specDisplayRating in CharacterCard.tsx). */
export async function setMainSpec(characterId: string, specId: string, role: string): Promise<SpecTrackDTO[]> {
  await prisma.$transaction([
    prisma.characterSpecTrack.updateMany({ where: { characterId }, data: { isMain: false } }),
    prisma.characterSpecTrack.upsert({
      where: { characterId_specId: { characterId, specId } },
      create: { characterId, specId, role, isMain: true },
      update: { isMain: true },
    }),
  ]);
  return getSpecTracks(characterId);
}
