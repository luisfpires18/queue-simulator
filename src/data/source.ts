// Data access for the real, user-driven model. UI/API depend on this, not Prisma directly.
import { prisma } from "@/lib/prisma";
import type { BlizzardChar } from "./blizzard";
import { bestSpecFor } from "@/game/roster";
import { specById, type Role } from "@/game/classes";
import { rankScoreFor } from "@/game/rating";
import { notify, notifyUser } from "@/server/notifications/dispatch";
import type { RaidKillDifficulty } from "@/game/raidSeason";
import { characterDungeonAchievement, meetsResilientRequirement, meetsCustomRequirement } from "@/game/achievements";

export interface CharacterDTO {
  id: string;
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  specId: string | null;
  level: number;
  ilvl: number | null;
  rating: number | null;
  faction: string;
  isMain: boolean;
  bucket: string; // "main" | "alt" | "hidden"
  sortOrder: number;
  wclZone: string | null;
  raidKills: RaidKillDTO[];
}

/** One boss at the highest difficulty ever killed - no parse/percentile, just
 * kill/no-kill + difficulty (see src/game/raidSeason.ts). One entry per boss. */
export interface RaidKillDTO {
  raidId: string;
  bossId: string;
  difficulty: RaidKillDifficulty;
}

/** One spec's best run on one dungeon this season — sourced from raider.io's
 * public API (see fetchRaiderIoRating in src/data/raiderio.ts). */
export interface DungeonBestRun {
  dungeonId: number;
  dungeonName: string;
  level: number;
  score: number;
  timed: boolean | null;
  completedAt: number | null; // epoch ms
}

export interface SpecTrackDTO {
  id: string;
  characterId: string;
  specId: string;
  role: string;
  points: number | null;
  bnetScore: number | null;
  isMain: boolean;
  bestRuns: DungeonBestRun[];
}

/** A character plus its tracked specs — the shape forms (List a key, Apply) build pickers from. */
export type RosterCharacterDTO = CharacterDTO & { specTracks: SpecTrackDTO[] };

/** The navbar's globally-selected character + spec — who List-a-key/Apply act as. */
export interface CurrentSelectionDTO {
  character: RosterCharacterDTO;
  specId: string;
}

export interface OpenSlot {
  role: string; // TANK | HEALER | DPS
  prefs: string[]; // ordered acceptable specIds (combo)
}

/** One member of a whole pre-made-group bundle (see Group.combos). */
export interface ComboMember {
  role: string; // TANK | HEALER | DPS
  specId: string;
}

export interface GroupDTO {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  kind: string; // "mplus" | "raid"
  dungeonId: string | null; // kind="mplus"
  keyLevel: number | null; // kind="mplus"
  raidId: string | null; // kind="raid"
  raidDifficulty: string | null; // kind="raid"
  raidSize: number | null; // kind="raid"
  ownerRole: string;
  startsAt: string | null; // null = forming now / ASAP
  slots: OpenSlot[];
  combos: ComboMember[][];
  // applicant requirement (optional, advisory only - see src/game/achievements.ts)
  requirementType: string | null; // "rating" | "resilient" | "custom"
  reqRating: number | null;
  reqLevel: number | null;
  reqExtraCount: number | null;
  reqExtraLevel: number | null;
  status: string;
  createdAt: string;
  members: (CharacterDTO & { role: string; slot: number; broughtSpecId: string | null })[];
}

function charDTO(c: {
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

function parseRaidKills(s: string): RaidKillDTO[] {
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

function parseSlots(s: string): OpenSlot[] {
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

function parseCombos(s: string): ComboMember[][] {
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

function parseBestRuns(s: string): DungeonBestRun[] {
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

// ---- Users ----
export async function ensureUser(bnetId: string, battletag?: string) {
  return prisma.user.upsert({
    where: { bnetId },
    create: { bnetId, battletag },
    update: { battletag },
  });
}

// ---- Characters ----
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
  const characters = await Promise.all(sorted.map(async (c) => ({ ...c, specTracks: await getSpecTracks(c.id) })));
  return {
    battletag: owner.user.showBattletag ? owner.user.battletag : null,
    country: owner.user.country,
    memberSince: owner.user.createdAt.toISOString(),
    characters,
  };
}

export interface CharacterRatingSummaryDTO {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  ilvl: number | null;
  specTracks: SpecTrackDTO[]; // every tracked spec, not just the one being viewed — lets the caller compare main vs. off spec
  raidKills: RaidKillDTO[];
}

/** Rating/best-runs for one character, all tracked specs — the "click a
 * filled slot on a key" lookup. Not owner-gated: a character actively
 * listing a key or applying to one is already implicitly visible (same
 * privacy bar as the public profile page), unlike the private roster board. */
export async function getCharacterRatingSummary(characterId: string): Promise<CharacterRatingSummaryDTO | null> {
  const char = await prisma.character.findUnique({ where: { id: characterId } });
  if (!char) return null;
  return {
    name: char.name, realm: char.realm, realmSlug: char.realmSlug, region: char.region, classId: char.classId,
    ilvl: char.ilvl,
    specTracks: await getSpecTracks(characterId),
    raidKills: parseRaidKills(char.raidKills),
  };
}

/** Persist a raid-kill sync (see /api/characters/[id]/raid-kills/sync) -
 * merges with whatever's already stored, keeping the HIGHER difficulty per
 * boss if a re-sync ever sees a lower one (WCL pagination can miss a kill
 * that was already recorded from an earlier, more complete sync). */
export async function setCharacterRaidKills(characterId: string, kills: RaidKillDTO[]) {
  const char = await prisma.character.findUnique({ where: { id: characterId } });
  if (!char) return;
  const existing = parseRaidKills(char.raidKills);
  const rank: Record<RaidKillDifficulty, number> = { lfr: 0, normal: 1, heroic: 2, mythic: 3 };
  const byBoss = new Map<string, RaidKillDTO>();
  for (const k of [...existing, ...kills]) {
    const key = `${k.raidId}:${k.bossId}`;
    const prev = byBoss.get(key);
    if (!prev || rank[k.difficulty] > rank[prev.difficulty]) byBoss.set(key, k);
  }
  await prisma.character.update({
    where: { id: characterId },
    data: { raidKills: JSON.stringify([...byBoss.values()]) },
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

/** Resolve this user's stored current-character selection against their live,
 * non-hidden roster. Falls back to (isMain ?? first) character and
 * bestSpecFor() when unset, or when the stored id/spec no longer resolves
 * (deleted, moved to hidden, spec no longer tracked). Null only when the user
 * has zero selectable (non-hidden) characters. */
export async function getCurrentSelection(userId: string): Promise<CurrentSelectionDTO | null> {
  const chars = await getUserCharacters(userId);
  const selectable = chars.filter((c) => c.bucket !== "hidden");
  if (selectable.length === 0) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const char = selectable.find((c) => c.id === user?.currentCharacterId)
    ?? selectable.find((c) => c.isMain)
    ?? selectable[0];

  const tracks = await getSpecTracks(char.id);
  const character: RosterCharacterDTO = { ...char, specTracks: tracks };

  // Valid = same class as the character, NOT "already has a CharacterSpecTrack
  // row" — the picker lets you choose any of the class's specs before you've
  // ever tracked/rated them (see specsFor's pre-curation fallback in
  // CurrentCharacterPicker.tsx), so requiring a pre-existing track here made
  // an untracked-but-legitimate pick (e.g. Guardian on a resto-only-tracked
  // druid) silently revert to bestSpecFor() on the very next read.
  const storedSpecId = char.id === user?.currentCharacterId ? user?.currentSpecId ?? null : null;
  const specId = storedSpecId && specById(storedSpecId)?.classId === char.classId ? storedSpecId : bestSpecFor(character);

  return { character, specId };
}

/** Persist the navbar picker's selection. Throws if the character isn't owned
 * by this user or is hidden. */
export async function setCurrentSelection(userId: string, characterId: string, specId: string): Promise<void> {
  const owned = await prisma.character.findFirst({ where: { id: characterId, userId, bucket: { not: "hidden" } } });
  if (!owned) throw new Error("Character not found, not owned, or hidden");
  await prisma.user.update({ where: { id: userId }, data: { currentCharacterId: characterId, currentSpecId: specId } });
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

// ---- Groups ----
export interface CreateGroupInput {
  title: string;
  description?: string | null;
  kind?: string; // "mplus" (default) | "raid"
  dungeonId?: string | null; // kind="mplus"
  keyLevel?: number | null; // kind="mplus"
  raidId?: string | null; // kind="raid"
  raidDifficulty?: string | null; // kind="raid"
  raidSize?: number | null; // kind="raid"
  ownerRole: string;
  ownerCharacterId: string;
  ownerSpecId: string;
  startsAt?: string | null;
  slots: OpenSlot[];
  combos?: ComboMember[][];
  requirementType?: string | null;
  reqRating?: number | null;
  reqLevel?: number | null;
  reqExtraCount?: number | null;
  reqExtraLevel?: number | null;
}

export async function createGroup(ownerUserId: string, input: CreateGroupInput) {
  const g = await prisma.group.create({
    data: {
      ownerUserId,
      title: input.title,
      description: input.description?.trim() || null,
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

function groupDTO(g: {
  id: string; ownerUserId: string; title: string; description: string | null;
  kind: string; dungeonId: string | null; keyLevel: number | null;
  raidId: string | null; raidDifficulty: string | null; raidSize: number | null;
  ownerRole: string; startsAt: Date | null; slots: string; combos: string;
  requirementType: string | null; reqRating: number | null; reqLevel: number | null;
  reqExtraCount: number | null; reqExtraLevel: number | null;
  status: string; createdAt: Date;
  members: { character: Parameters<typeof charDTO>[0]; role: string; slot: number; specId: string | null }[];
}): GroupDTO {
  return {
    id: g.id, ownerUserId: g.ownerUserId, title: g.title, description: g.description,
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
      ...charDTO(m.character), role: m.role, slot: m.slot, broughtSpecId: m.specId,
    })),
  };
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

// ---- Applications ----
export interface ApplicationDTO {
  id: string;
  groupId: string;
  applicantUserId: string;
  characterId: string;
  characterName: string;
  characterRealm: string;
  characterRealmSlug: string;
  characterRegion: string;
  classId: string;
  characterIlvl: number | null;
  characterRaidKills: RaidKillDTO[];
  role: string;
  specId: string;
  note: string | null;
  status: string; // pending | accepted | declined
  createdAt: string;
}

function applicationDTO(a: {
  id: string; groupId: string; applicantUserId: string; characterId: string;
  role: string; specId: string; note: string | null; status: string; createdAt: Date;
  character: { name: string; realm: string; realmSlug: string; region: string; classId: string; ilvl: number | null; raidKills: string };
}): ApplicationDTO {
  return {
    id: a.id, groupId: a.groupId, applicantUserId: a.applicantUserId, characterId: a.characterId,
    characterName: a.character.name, characterRealm: a.character.realm, characterRealmSlug: a.character.realmSlug,
    characterRegion: a.character.region, classId: a.character.classId, characterIlvl: a.character.ilvl,
    characterRaidKills: parseRaidKills(a.character.raidKills),
    role: a.role, specId: a.specId, note: a.note, status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

export interface ApplyInput {
  groupId: string;
  characterId: string;
  specId: string;
  role: string;
  note?: string | null;
}

/** Applying again while a pending application already exists from this user
 * refreshes it in place (new character/spec/note) rather than piling up
 * duplicates. A past accepted/declined application doesn't block a new one. */
export async function createApplication(applicantUserId: string, input: ApplyInput): Promise<ApplicationDTO> {
  const note = input.note?.trim() || null;
  const existing = await prisma.application.findFirst({
    where: { groupId: input.groupId, applicantUserId, status: "pending" },
  });
  const a = existing
    ? await prisma.application.update({
        where: { id: existing.id },
        data: { characterId: input.characterId, specId: input.specId, role: input.role, note },
        include: { character: true },
      })
    : await prisma.application.create({
        data: {
          groupId: input.groupId, applicantUserId, characterId: input.characterId,
          specId: input.specId, role: input.role, note, status: "pending",
        },
        include: { character: true },
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

/** A declined application isn't deleted - re-applying (see createApplication)
 * inserts a fresh row rather than reviving the old one - so declines for a
 * given group/applicant just pile up and are cheap to count directly. */
export async function countDeclinedApplications(groupId: string, applicantUserId: string): Promise<number> {
  return prisma.application.count({ where: { groupId, applicantUserId, status: "declined" } });
}


export interface ApplicationWithRatingDTO extends ApplicationDTO {
  specTracks: SpecTrackDTO[]; // every tracked spec on the applicant's character — lets the UI compare main vs. the spec they applied with
  rankedByMain: boolean; // sort position driven by their main spec's (higher) score, not the spec they're actually applying with
  meetsRequirement: boolean | null; // null = the listing has no requirement; advisory only, never gates /apply
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
 * from Group.slots, in one transaction. Returns false if the caller isn't the
 * group's owner or the application isn't pending. */
export async function acceptApplication(applicationId: string, ownerUserId: string): Promise<boolean> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || app.status !== "pending") return false;
  const group = await prisma.group.findUnique({
    where: { id: app.groupId },
    include: { members: { select: { slot: true } } },
  });
  if (!group || group.ownerUserId !== ownerUserId) return false;

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
  ]);

  notifyUser(app.applicantUserId, {
    title: "Application accepted",
    body: `You're in for "${group.title}"!`,
    url: "/runs",
  }).catch((err) => console.error("notifyUser accept failed", err));
  return true;
}

/** Returns false if the caller isn't the group's owner or the application
 * isn't pending. */
export async function declineApplication(applicationId: string, ownerUserId: string): Promise<boolean> {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { group: true } });
  if (!app || app.status !== "pending") return false;
  if (app.group.ownerUserId !== ownerUserId) return false;

  await prisma.application.update({ where: { id: applicationId }, data: { status: "declined" } });

  notifyUser(app.applicantUserId, {
    title: "Application declined",
    body: `Your application for "${app.group.title}" was declined.`,
    url: "/runs",
  }).catch((err) => console.error("notifyUser decline failed", err));
  return true;
}
