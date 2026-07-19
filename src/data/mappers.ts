// Prisma-row -> DTO mappers plus the defensive parsers for the JSON-string
// columns (SQLite has no JSON type). Parsers return empty on malformed data
// by design - a corrupt row degrades to "no slots/kills/runs", it doesn't
// 500 a whole board query. Shared by the data modules only; nothing outside
// src/data should need these.
import type { RaidKillDifficulty } from "@/game/raidSeason";
import type {
  ApplicationDTO,
  CharacterDTO,
  ComboMember,
  DungeonBestRun,
  GroupDTO,
  OpenSlot,
  RaidKillDTO,
} from "./dto";

export function charDTO(c: {
  id: string; name: string; realm: string; realmSlug: string; region: string;
  classId: string; specId: string | null; level: number; ilvl: number | null;
  rating: number | null; faction: string; isMain: boolean;
  wclZone: string | null; bucket: string; sortOrder: number; raidKills: string;
}): CharacterDTO {
  return {
    id: c.id, name: c.name, realm: c.realm, realmSlug: c.realmSlug, region: c.region,
    classId: c.classId, specId: c.specId, level: c.level, ilvl: c.ilvl,
    rating: c.rating, faction: c.faction, isMain: c.isMain,
    wclZone: c.wclZone, bucket: c.bucket, sortOrder: c.sortOrder,
    raidKills: parseRaidKills(c.raidKills),
  };
}

const RAID_KILL_DIFFICULTY_VALUES = new Set(["normal", "heroic", "mythic", "lfr"]);

export function parseRaidKills(s: string): RaidKillDTO[] {
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x) =>
          x && typeof x.raidId === "string" && typeof x.bossId === "string" &&
          typeof x.difficulty === "string" && RAID_KILL_DIFFICULTY_VALUES.has(x.difficulty)
      )
      .map((x) => ({ raidId: x.raidId, bossId: x.bossId, difficulty: x.difficulty as RaidKillDifficulty }));
  } catch {
    return [];
  }
}

export function parseSlots(s: string): OpenSlot[] {
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.role === "string")
      .map((x) => ({ role: x.role, prefs: Array.isArray(x.prefs) ? x.prefs : [] }));
  } catch {
    return [];
  }
}

export function parseCombos(s: string): ComboMember[][] {
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) return [];
    return v
      .filter((combo) => Array.isArray(combo))
      .map((combo) =>
        combo.filter((m: unknown): m is ComboMember =>
          Boolean(m && typeof (m as ComboMember).role === "string" && typeof (m as ComboMember).specId === "string")
        )
      )
      .filter((combo) => combo.length >= 2 && combo.length <= 4);
  } catch {
    return [];
  }
}

export function parseBestRuns(s: string): DungeonBestRun[] {
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.dungeonId === "number" && typeof x.dungeonName === "string" && typeof x.level === "number" && typeof x.score === "number")
      .map((x) => ({
        dungeonId: x.dungeonId,
        dungeonName: x.dungeonName,
        level: x.level,
        score: x.score,
        timed: typeof x.timed === "boolean" ? x.timed : null,
        completedAt: typeof x.completedAt === "number" ? x.completedAt : null,
      }));
  } catch {
    return [];
  }
}

export function groupDTO(g: {
  id: string; ownerUserId: string; title: string; description: string | null; route: string | null;
  kind: string; dungeonId: string | null; keyLevel: number | null;
  raidId: string | null; raidDifficulty: string | null; raidSize: number | null;
  ownerRole: string; startsAt: Date | null; slots: string; combos: string;
  requirementType: string | null; reqRating: number | null; reqLevel: number | null;
  reqExtraCount: number | null; reqExtraLevel: number | null;
  status: string; createdAt: Date;
  members: { character: Parameters<typeof charDTO>[0] & { userId: string }; role: string; slot: number; specId: string | null }[];
}): GroupDTO {
  return {
    id: g.id, ownerUserId: g.ownerUserId, title: g.title, description: g.description, route: g.route,
    kind: g.kind, dungeonId: g.dungeonId, keyLevel: g.keyLevel,
    raidId: g.raidId, raidDifficulty: g.raidDifficulty, raidSize: g.raidSize,
    ownerRole: g.ownerRole,
    startsAt: g.startsAt ? g.startsAt.toISOString() : null,
    slots: parseSlots(g.slots),
    combos: parseCombos(g.combos),
    requirementType: g.requirementType, reqRating: g.reqRating, reqLevel: g.reqLevel,
    reqExtraCount: g.reqExtraCount, reqExtraLevel: g.reqExtraLevel,
    status: g.status, createdAt: g.createdAt.toISOString(),
    members: g.members.map((m) => ({
      ...charDTO(m.character), role: m.role, slot: m.slot, broughtSpecId: m.specId, userId: m.character.userId,
    })),
  };
}

export function applicationDTO(a: {
  id: string; groupId: string; applicantUserId: string; characterId: string;
  role: string; specId: string; note: string | null; route: string | null; status: string; source: string; createdAt: Date;
  character: {
    name: string; realm: string; realmSlug: string; region: string;
    classId: string; ilvl: number | null; raidKills: string;
  };
}): ApplicationDTO {
  return {
    id: a.id, groupId: a.groupId, applicantUserId: a.applicantUserId, characterId: a.characterId,
    characterName: a.character.name, characterRealm: a.character.realm, characterRealmSlug: a.character.realmSlug,
    characterRegion: a.character.region, classId: a.character.classId, characterIlvl: a.character.ilvl,
    characterRaidKills: parseRaidKills(a.character.raidKills),
    role: a.role, specId: a.specId, note: a.note, route: a.route, status: a.status, source: a.source,
    createdAt: a.createdAt.toISOString(),
  };
}
