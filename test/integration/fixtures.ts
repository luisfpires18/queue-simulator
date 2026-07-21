// Row builders for the integration tests. Every field the tests do not care
// about gets a sane default, so a test body only states what it is actually
// about.
import { prisma } from "@/lib/prisma";
import { computeExpiry } from "@/game/expiry";

let seq = 0;
const uniq = () => `${Date.now()}-${seq++}`;

export async function makeUser(name = "user") {
  return prisma.user.create({
    data: { bnetId: `test-${name}-${uniq()}`, battletag: `${name}#0001` },
  });
}

export async function makeCharacter(userId: string, over: Partial<{ name: string; classId: string; specId: string }> = {}) {
  return prisma.character.create({
    data: {
      userId,
      name: over.name ?? `Char${uniq()}`,
      realm: "Khadgar",
      realmSlug: "khadgar",
      region: "eu",
      classId: over.classId ?? "paladin",
      specId: over.specId ?? "paladin:holy",
      ilvl: 620,
      rating: 2400,
    },
  });
}

/** An open M+ team post with `positionCount` unfilled DPS/HEALER positions. */
export async function makeMPlusPost(
  ownerUserId: string,
  over: { status?: string; positionCount?: number; expiresAt?: Date } = {}
) {
  const now = new Date();
  return prisma.mPlusRecruitmentPost.create({
    data: {
      ownerUserId,
      postType: "team_lfp",
      title: "Test team",
      teamName: "Test Team",
      region: "eu",
      languages: JSON.stringify(["en"]),
      availability: JSON.stringify([{ day: 2, startMin: 1200, endMin: 1380 }]),
      goal: "push",
      currentKeyMin: 18,
      currentKeyMax: 22,
      status: over.status ?? "open",
      refreshedAt: now,
      expiresAt: over.expiresAt ?? computeExpiry(now, "mplus"),
      positions: {
        create: Array.from({ length: over.positionCount ?? 1 }, (_, i) => ({
          role: i === 0 ? "HEALER" : "DPS",
          preferredSpecIds: "[]",
          acceptedSpecIds: "[]",
        })),
      },
    },
    include: { positions: true },
  });
}

export async function makeGuildTeam(ownerUserId: string, over: { status?: string } = {}) {
  const now = new Date();
  const guild = await prisma.guild.create({
    data: {
      ownerUserId,
      name: `Guild${uniq()}`,
      region: "eu",
      realm: "Khadgar",
      realmSlug: "khadgar",
      languages: JSON.stringify(["en"]),
    },
  });
  const team = await prisma.raidTeam.create({
    data: {
      guildId: guild.id,
      name: "Main raid",
      difficulty: "mythic",
      availability: JSON.stringify([{ day: 2, startMin: 1200, endMin: 1380 }]),
      status: over.status ?? "open",
      refreshedAt: now,
      expiresAt: computeExpiry(now, "guild"),
      positions: { create: [{ role: "DPS", recruitmentType: "core", preferredSpecIds: "[]", acceptedSpecIds: "[]" }] },
    },
    include: { positions: true },
  });
  return { guild, team };
}

/** The standard two-party setup: an owner with a post, and an applicant with a
 * character ready to apply. */
export async function makeApplyScenario(over: { positionCount?: number } = {}) {
  const owner = await makeUser("owner");
  const applicant = await makeUser("applicant");
  const post = await makeMPlusPost(owner.id, { positionCount: over.positionCount ?? 1 });
  const character = await makeCharacter(applicant.id);
  return { owner, applicant, post, character };
}

export function applyInput(post: { id: string; positions: { id: string }[] }, characterId: string) {
  return {
    recruitmentType: "mplus",
    targetId: post.id,
    positionId: post.positions[0]?.id ?? null,
    characterId,
    specId: "paladin:holy",
    role: "HEALER",
    availability: [{ day: 2, startMin: 1200, endMin: 1380 }],
  };
}
