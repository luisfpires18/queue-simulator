// Season History: freezing a copy of each character's rating/roster state
// into CharacterSeasonSnapshot (see schema.prisma), and reading it back for
// /profile's Season History tab. The write side is called by the daily
// snapshot job (src/server/season/snapshotter.ts); the read side by
// GET /api/profile/history.
import { prisma } from "@/lib/prisma";
import { seasonById, type SeasonDef } from "@/game/season";
import { parseBestRuns, parseRaidKills } from "./mappers";
import type { DungeonBestRun, RaidKillDTO } from "./dto";

interface SnapshotSpecTrack {
  specId: string;
  role: string;
  points: number | null;
  bnetScore: number | null;
  isMain: boolean;
  bestRuns: DungeonBestRun[];
}

/** The shape src/components/CharacterCard.tsx's CardCharacter expects -
 * duplicated here (not imported from a component file) to keep the data
 * layer independent of the UI layer; structurally identical on purpose. */
export interface SeasonCharacterSnapshotDTO {
  id: string;
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  level: number;
  ilvl: number | null;
  rating: number | null;
  isMain: boolean;
  bucket: string;
  specTracks: SnapshotSpecTrack[];
  raidKills: RaidKillDTO[];
}

export function parseSnapshotSpecTracks(raw: string): SnapshotSpecTrack[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.specId === "string" && typeof x.role === "string")
      .map((x) => ({
        specId: x.specId,
        role: x.role,
        points: typeof x.points === "number" ? x.points : null,
        bnetScore: typeof x.bnetScore === "number" ? x.bnetScore : null,
        isMain: Boolean(x.isMain),
        bestRuns: Array.isArray(x.bestRuns) ? x.bestRuns : [],
      }));
  } catch {
    return [];
  }
}

/** Upserts a CharacterSeasonSnapshot for every character in the app, keyed
 * to `seasonId` - re-running it just refreshes the same rows (see the
 * model's own schema comment). Returns the count written. */
export async function snapshotAllCharacters(seasonId: string): Promise<number> {
  const characters = await prisma.character.findMany({ include: { specTracks: true } });

  let count = 0;
  for (const c of characters) {
    const specTracks: SnapshotSpecTrack[] = c.specTracks.map((t) => ({
      specId: t.specId,
      role: t.role,
      points: t.points,
      bnetScore: t.bnetScore,
      isMain: t.isMain,
      bestRuns: parseBestRuns(t.bestRuns),
    }));

    const data = {
      name: c.name, realm: c.realm, realmSlug: c.realmSlug, region: c.region,
      classId: c.classId, faction: c.faction, level: c.level, ilvl: c.ilvl, rating: c.rating,
      bucket: c.bucket, isMain: c.isMain, raidKills: c.raidKills,
      specTracks: JSON.stringify(specTracks),
    };

    await prisma.characterSeasonSnapshot.upsert({
      where: { characterId_seasonId: { characterId: c.id, seasonId } },
      create: { characterId: c.id, seasonId, ...data },
      update: data,
    });
    count++;
  }
  return count;
}

/** Which seasons this user actually has snapshot data for (not every known
 * season - only ones a snapshot has actually run for while it was current). */
export async function listSnapshottedSeasons(userId: string): Promise<SeasonDef[]> {
  const rows = await prisma.characterSeasonSnapshot.findMany({
    where: { character: { userId } },
    select: { seasonId: true },
    distinct: ["seasonId"],
  });
  return rows.map((r) => seasonById(r.seasonId));
}

/** One user's roster as it looked in a given season - excludes characters
 * that had no snapshot row for that season (e.g. synced/created after that
 * season was frozen). Null if the user has no snapshot data for this season
 * at all (caller should treat that as "nothing to show", not an error). */
export async function getSeasonHistory(userId: string, seasonId: string): Promise<SeasonCharacterSnapshotDTO[] | null> {
  const rows = await prisma.characterSeasonSnapshot.findMany({
    where: { seasonId, character: { userId } },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
  });
  if (rows.length === 0) return null;

  return rows.map((r) => ({
    id: r.characterId,
    name: r.name, realm: r.realm, realmSlug: r.realmSlug, region: r.region,
    classId: r.classId, level: r.level, ilvl: r.ilvl, rating: r.rating,
    isMain: r.isMain, bucket: r.bucket,
    specTracks: parseSnapshotSpecTracks(r.specTracks),
    raidKills: parseRaidKills(r.raidKills),
  }));
}
