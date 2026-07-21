// Data access for persistent Mythic+ recruitment posts.
//
// Deliberately does NOT touch src/data/groups.ts: a Group is one live key that
// forms and dies, an MPlusRecruitmentPost is a standing advert. They share no
// rows, no status vocabulary and no expiry rules.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeExpiry, statusAfterPositionChange } from "@/game/expiry";
import { mplusPostDTO, serializeJson } from "./recruitmentMappers";
import {
  CHARACTER_SELECT,
  browsableWhere,
  clampLimit,
  positionAcceptsSpec,
} from "./recruitmentShared";
import { blockedUserIds } from "./moderation";
import type {
  CreateMPlusPostInput,
  MPlusPostFilters,
  MPlusRecruitmentPostDTO,
  RecruitmentCharacterInput,
  RecruitmentPositionInput,
} from "./recruitmentDto";

/** Full read shape - every list and get returns this so callers always get a
 * complete DTO and never a half-populated post. */
const POST_INCLUDE = {
  characters: { include: { character: { select: CHARACTER_SELECT } } },
  positions: true,
} as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getMPlusPost(id: string): Promise<MPlusRecruitmentPostDTO | null> {
  const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id }, include: POST_INCLUDE });
  return row ? mplusPostDTO(row) : null;
}

export async function listMPlusPosts(
  filters: MPlusPostFilters = {},
  now: Date = new Date()
): Promise<MPlusRecruitmentPostDTO[]> {
  const {
    postType,
    postTypes,
    region,
    languages,
    goal,
    role,
    specId,
    keyMin,
    keyMax,
    voiceRequired,
    teamMaturity,
    isPermanent,
    ownerUserId,
    includeExpired,
    limit,
    viewerUserId,
  } = filters;

  // Blocking hides listings, not just applications. Without this a blocked
  // user still fills your browse page - the block would stop them contacting
  // you but not stop you seeing them, which is half a feature.
  const hidden = viewerUserId ? await blockedUserIds(viewerUserId) : new Set<string>();

  // Built as an AND array rather than one object literal: several of these
  // clauses target the same key (`positions`, and the key-range OR pairs), and
  // spreading them into a single object would silently drop all but the last.
  const and: Prisma.MPlusRecruitmentPostWhereInput[] = [];

  if (postType) and.push({ postType });
  if (postTypes?.length) and.push({ postType: { in: postTypes } });
  if (region) and.push({ region });
  if (goal) and.push({ goal });
  if (voiceRequired !== undefined) and.push({ voiceRequired });
  if (teamMaturity) and.push({ teamMaturity });

  // Key-range filters mean "the post's range intersects mine", not "matches
  // exactly" - a team running +18 to +22 must show for someone searching +20.
  // A null bound is open-ended, so it always passes.
  if (keyMin !== undefined) and.push({ OR: [{ currentKeyMax: null }, { currentKeyMax: { gte: keyMin } }] });
  if (keyMax !== undefined) and.push({ OR: [{ currentKeyMin: null }, { currentKeyMin: { lte: keyMax } }] });

  // Role IS a real column on the position table, so this half filters in SQL.
  // The spec half can't (JSON columns) and runs in memory below.
  if (role) and.push({ positions: { some: { role, isFilled: false } } });
  if (isPermanent !== undefined) and.push({ positions: { some: { isPermanent, isFilled: false } } });

  if (hidden.size) and.push({ ownerUserId: { notIn: [...hidden] } });

  const rows = await prisma.mPlusRecruitmentPost.findMany({
    where: {
      ...browsableWhere(now, includeExpired || !!ownerUserId),
      ...(ownerUserId ? { ownerUserId } : {}),
      ...(and.length ? { AND: and } : {}),
    },
    include: POST_INCLUDE,
    orderBy: { refreshedAt: "desc" },
    take: clampLimit(limit),
  });

  let posts = rows.map(mplusPostDTO);

  // ---- in-memory filters for the JSON columns SQLite can't query ----
  if (languages?.length) {
    posts = posts.filter((p) => p.languages.some((l) => languages.includes(l)));
  }
  if (specId) {
    posts = posts.filter((p) =>
      p.positions.some(
        (pos) => !pos.isFilled && (!role || pos.role === role) && positionAcceptsSpec(pos, specId)
      )
    );
  }
  return posts;
}

/** Everything the signed-in user owns, expired and paused included, for the My
 * Recruitment tab. */
export function listMyMPlusPosts(userId: string): Promise<MPlusRecruitmentPostDTO[]> {
  return listMPlusPosts({ ownerUserId: userId, includeExpired: true });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function characterCreateData(c: RecruitmentCharacterInput) {
  return {
    characterId: c.characterId,
    primarySpecId: c.primarySpecId,
    alternateSpecIds: serializeJson(c.alternateSpecIds ?? []),
    preferredRole: c.preferredRole,
    willingRoles: serializeJson(c.willingRoles ?? []),
    isMain: c.isMain ?? false,
    isCurrentMember: c.isCurrentMember ?? false,
    teamRole: c.teamRole ?? null,
  };
}

function positionCreateData(p: RecruitmentPositionInput) {
  return {
    role: p.role,
    preferredSpecIds: serializeJson(p.preferredSpecIds ?? []),
    acceptedSpecIds: serializeJson(p.acceptedSpecIds ?? []),
    priority: p.priority ?? 0,
    isPermanent: p.isPermanent ?? true,
    isFlexible: p.isFlexible ?? false,
    isFilled: p.isFilled ?? false,
  };
}

/** Scalar columns shared by create and update. Characters and positions are
 * handled separately since updating them means replacing the child rows. */
function postScalarData(input: CreateMPlusPostInput) {
  return {
    postType: input.postType,
    title: input.title,
    description: input.description ?? null,
    teamName: input.teamName ?? null,
    region: input.region,
    country: input.country ?? null,
    languages: serializeJson(input.languages),
    timeZone: input.timeZone ?? null,
    availability: serializeJson(input.availability),
    goal: input.goal,
    currentKeyMin: input.currentKeyMin ?? null,
    currentKeyMax: input.currentKeyMax ?? null,
    targetKeyMin: input.targetKeyMin ?? null,
    targetKeyMax: input.targetKeyMax ?? null,
    voiceRequired: input.voiceRequired ?? false,
    voicePlatform: input.voicePlatform ?? null,
    teamMaturity: input.teamMaturity ?? null,
    atmosphere: input.atmosphere ?? null,
    showLogs: input.showLogs ?? false,
    showProfile: input.showProfile ?? true,
  };
}

export async function createMPlusPost(
  ownerUserId: string,
  input: CreateMPlusPostInput,
  now: Date = new Date()
): Promise<MPlusRecruitmentPostDTO> {
  const row = await prisma.mPlusRecruitmentPost.create({
    data: {
      ownerUserId,
      ...postScalarData(input),
      refreshedAt: now,
      expiresAt: computeExpiry(now, "mplus"),
      characters: { create: input.characters.map(characterCreateData) },
      positions: { create: (input.positions ?? []).map(positionCreateData) },
    },
    include: POST_INCLUDE,
  });
  return mplusPostDTO(row);
}

/** Child rows are replaced wholesale rather than diffed: the form always
 * submits the complete roster and position list, so a diff would be more code
 * for the same result. Wrapped in a transaction so a post is never left with
 * its old positions and new scalars. */
export async function updateMPlusPost(
  postId: string,
  input: CreateMPlusPostInput
): Promise<MPlusRecruitmentPostDTO> {
  const row = await prisma.$transaction(async (tx) => {
    await tx.mPlusRecruitmentCharacter.deleteMany({ where: { postId } });
    await tx.mPlusRecruitmentPosition.deleteMany({ where: { postId } });
    return tx.mPlusRecruitmentPost.update({
      where: { id: postId },
      data: {
        ...postScalarData(input),
        characters: { create: input.characters.map(characterCreateData) },
        positions: { create: (input.positions ?? []).map(positionCreateData) },
      },
      include: POST_INCLUDE,
    });
  });
  return mplusPostDTO(row);
}

/** Applications are deleted explicitly: RecruitmentApplication.targetId
 * addresses either a post or a raid team, so it has no FK and no cascade.
 * Skipping this would leave orphan rows pointing at a dead post. */
export async function deleteMPlusPost(postId: string): Promise<void> {
  await prisma.$transaction([
    prisma.recruitmentApplication.deleteMany({ where: { recruitmentType: "mplus", targetId: postId } }),
    prisma.mPlusRecruitmentPost.delete({ where: { id: postId } }),
  ]);
}

/** Pushes the expiry back out and re-floats the post to the top of browse.
 * Separate from any edit so fixing a typo doesn't relaunch a stale listing. */
export async function refreshMPlusPost(
  postId: string,
  now: Date = new Date()
): Promise<MPlusRecruitmentPostDTO> {
  // An expired listing is revived by refreshing it - otherwise the sweep would
  // be a one-way door and the owner's only recourse would be recreating the
  // post from scratch. Any other status (paused, closed, filled) is a decision
  // the owner made, so refresh leaves it alone.
  const existing = await prisma.mPlusRecruitmentPost.findUnique({
    where: { id: postId },
    select: { status: true },
  });

  const row = await prisma.mPlusRecruitmentPost.update({
    where: { id: postId },
    data: {
      refreshedAt: now,
      expiresAt: computeExpiry(now, "mplus"),
      ...(existing?.status === "expired" ? { status: "open" } : {}),
    },
    include: POST_INCLUDE,
  });
  return mplusPostDTO(row);
}

export async function setMPlusPostStatus(
  postId: string,
  status: string
): Promise<MPlusRecruitmentPostDTO> {
  const row = await prisma.mPlusRecruitmentPost.update({
    where: { id: postId },
    data: { status },
    include: POST_INCLUDE,
  });
  return mplusPostDTO(row);
}

// ---------------------------------------------------------------------------
// Roster and positions
// ---------------------------------------------------------------------------

export async function addRosterMember(
  postId: string,
  input: RecruitmentCharacterInput
): Promise<MPlusRecruitmentPostDTO> {
  await prisma.mPlusRecruitmentCharacter.create({
    data: { postId, ...characterCreateData({ ...input, isCurrentMember: input.isCurrentMember ?? true }) },
  });
  return (await getMPlusPost(postId))!;
}

export async function removeRosterMember(postId: string, characterId: string): Promise<void> {
  await prisma.mPlusRecruitmentCharacter.deleteMany({ where: { postId, characterId } });
}

export async function setMemberTeamRole(
  postId: string,
  characterId: string,
  teamRole: string | null
): Promise<void> {
  await prisma.mPlusRecruitmentCharacter.updateMany({ where: { postId, characterId }, data: { teamRole } });
}

/** Marks a position filled or open and applies the auto-close rule: a post
 * whose every position is filled flips to "filled" on its own, so a team that
 * finished recruiting stops appearing in browse without anyone remembering to
 * close it. The rule itself is pure and tested in src/game/expiry.test.ts. */
export async function setPositionFilled(
  postId: string,
  positionId: string,
  isFilled: boolean
): Promise<MPlusRecruitmentPostDTO | null> {
  const updated = await prisma.$transaction(async (tx) => {
    // Scoped by postId, not just position id: the caller has only been
    // authorized against THIS post, so an id belonging to someone else's post
    // must not be writable through it. updateMany's where accepts both, and a
    // count of 0 means the position was not on this post.
    const { count } = await tx.mPlusRecruitmentPosition.updateMany({
      where: { id: positionId, postId },
      data: { isFilled },
    });
    if (!count) return false;

    const post = await tx.mPlusRecruitmentPost.findUnique({
      where: { id: postId },
      select: { status: true, positions: { select: { isFilled: true } } },
    });
    if (!post) return false;

    const next = statusAfterPositionChange(post.status, post.positions);
    if (next !== post.status) {
      await tx.mPlusRecruitmentPost.update({ where: { id: postId }, data: { status: next } });
    }
    return true;
  });

  return updated ? await getMPlusPost(postId) : null;
}
