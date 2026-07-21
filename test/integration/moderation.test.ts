import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { listMPlusPosts } from "@/data/mplusRecruitment";
import { listRaidTeams } from "@/data/guilds";
import { listRaiderProfiles } from "@/data/raiderProfiles";
import { blockUser, blockedUserIds, createReport, hasReported, isBlockedEither, unblockUser } from "@/data/moderation";
import { checkLimit } from "@/server/rateLimit";
import { RATE_LIMITS } from "@/game/rateLimit";
import { createApplication } from "@/data/recruitmentApplications";
import { applyInput, makeApplyScenario, makeCharacter, makeGuildTeam, makeMPlusPost, makeUser } from "./fixtures";

describe("blocking hides listings from browse", () => {
  it("hides an M+ post owned by someone the viewer blocked", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const post = await makeMPlusPost(owner.id);

    // Visible before the block.
    const before = await listMPlusPosts({ viewerUserId: viewer.id });
    expect(before.map((p) => p.id)).toContain(post.id);

    await blockUser(viewer.id, owner.id);

    const after = await listMPlusPosts({ viewerUserId: viewer.id });
    expect(after.map((p) => p.id)).not.toContain(post.id);
  });

  it("hides it in the other direction too, when the OWNER blocked the viewer", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const post = await makeMPlusPost(owner.id);

    await blockUser(owner.id, viewer.id);

    const list = await listMPlusPosts({ viewerUserId: viewer.id });
    expect(list.map((p) => p.id)).not.toContain(post.id);
  });

  it("still shows the post to everyone else", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const bystander = await makeUser("bystander");
    const post = await makeMPlusPost(owner.id);
    await blockUser(viewer.id, owner.id);

    const list = await listMPlusPosts({ viewerUserId: bystander.id });
    expect(list.map((p) => p.id)).toContain(post.id);
  });

  it("still shows the post to anonymous viewers", async () => {
    // No viewer id means no block filtering - browsing signed out is not a way
    // to be shielded, and equally not a way to be hidden from.
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const post = await makeMPlusPost(owner.id);
    await blockUser(viewer.id, owner.id);

    const list = await listMPlusPosts({});
    expect(list.map((p) => p.id)).toContain(post.id);
  });

  it("comes back once unblocked", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const post = await makeMPlusPost(owner.id);

    await blockUser(viewer.id, owner.id);
    await unblockUser(viewer.id, owner.id);

    const list = await listMPlusPosts({ viewerUserId: viewer.id });
    expect(list.map((p) => p.id)).toContain(post.id);
  });

  it("hides a raid team owned through a blocked guild", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const { team } = await makeGuildTeam(owner.id);

    expect((await listRaidTeams({ viewerUserId: viewer.id })).map((t) => t.id)).toContain(team.id);
    await blockUser(viewer.id, owner.id);
    expect((await listRaidTeams({ viewerUserId: viewer.id })).map((t) => t.id)).not.toContain(team.id);
  });

  it("hides a blocked user's raider profile", async () => {
    const owner = await makeUser("owner");
    const viewer = await makeUser("viewer");
    const character = await makeCharacter(owner.id);
    const profile = await prisma.raiderProfile.create({
      data: {
        ownerUserId: owner.id,
        characterId: character.id,
        primarySpecId: "paladin:holy",
        preferredRole: "HEALER",
        region: "eu",
        languages: JSON.stringify(["en"]),
        preferredDifficulty: "mythic",
        refreshedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    expect((await listRaiderProfiles({ viewerUserId: viewer.id })).map((p) => p.id)).toContain(profile.id);
    await blockUser(viewer.id, owner.id);
    expect((await listRaiderProfiles({ viewerUserId: viewer.id })).map((p) => p.id)).not.toContain(profile.id);
  });
});

describe("block bookkeeping", () => {
  it("is symmetric", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await blockUser(a.id, b.id);
    expect(await isBlockedEither(a.id, b.id)).toBe(true);
    expect(await isBlockedEither(b.id, a.id)).toBe(true);
  });

  it("collects both directions into one id set", async () => {
    const me = await makeUser("me");
    const iBlocked = await makeUser("them");
    const blockedMe = await makeUser("other");
    await blockUser(me.id, iBlocked.id);
    await blockUser(blockedMe.id, me.id);

    const ids = await blockedUserIds(me.id);
    expect(ids.has(iBlocked.id)).toBe(true);
    expect(ids.has(blockedMe.id)).toBe(true);
    expect(ids.size).toBe(2);
  });

  it("is idempotent", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await blockUser(a.id, b.id);
    await blockUser(a.id, b.id, "changed my mind about why");
    expect(await prisma.userBlock.count({ where: { blockerUserId: a.id } })).toBe(1);
  });

  it("refuses to let a user block themselves", async () => {
    const a = await makeUser("a");
    expect(await blockUser(a.id, a.id)).toBeNull();
    expect(await isBlockedEither(a.id, a.id)).toBe(false);
  });
});

describe("reports", () => {
  it("records one report per user per target, updating rather than piling up", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);

    await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "spam",
    });
    await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "boosting",
      detail: "actually this",
    });

    const rows = await prisma.report.findMany({ where: { targetId: post.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("boosting");
    expect(await hasReported(reporter.id, "mplus_post", post.id)).toBe(true);
  });

  it("keeps different reporters' reports separate", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    const a = await makeUser("a");
    const b = await makeUser("b");

    for (const u of [a, b]) {
      await createReport({
        reporterUserId: u.id,
        targetType: "mplus_post",
        targetId: post.id,
        category: "spam",
      });
    }
    expect(await prisma.report.count({ where: { targetId: post.id } })).toBe(2);
  });
});

describe("rate limiting", () => {
  it("allows a normal first application", async () => {
    const { applicant } = await makeApplyScenario();
    expect((await checkLimit("apply", applicant.id)).allowed).toBe(true);
  });

  it("refuses once the hourly application limit is reached", async () => {
    const { applicant, character } = await makeApplyScenario();
    const owner = await makeUser("owner2");

    // Real applications to real posts, so the counter is counting the same
    // rows the app creates.
    for (let i = 0; i < RATE_LIMITS.apply.perWindow; i++) {
      const post = await makeMPlusPost(owner.id);
      await createApplication(applicant.id, applyInput(post, character.id));
    }

    const verdict = await checkLimit("apply", applicant.id);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("rate");
  });

  it("does not count applications from an hour ago", async () => {
    const { applicant, character } = await makeApplyScenario();
    const owner = await makeUser("owner2");
    for (let i = 0; i < RATE_LIMITS.apply.perWindow; i++) {
      const post = await makeMPlusPost(owner.id);
      await createApplication(applicant.id, applyInput(post, character.id));
    }
    // Age them past the window.
    await prisma.recruitmentApplication.updateMany({
      where: { applicantUserId: applicant.id },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    // The rate window has cleared. The concurrent cap is higher than the
    // hourly rate, so this is specifically testing the window.
    const verdict = await checkLimit("apply", applicant.id);
    expect(verdict.reason).not.toBe("rate");
  });

  it("refuses once too many posts are live, regardless of when they were made", async () => {
    const owner = await makeUser("owner");
    const cap = RATE_LIMITS.create_mplus_post.maxConcurrent!;
    for (let i = 0; i < cap; i++) await makeMPlusPost(owner.id);
    // Age them all out of the rate window, leaving only the concurrent cap.
    await prisma.mPlusRecruitmentPost.updateMany({
      where: { ownerUserId: owner.id },
      data: { createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    });

    const verdict = await checkLimit("create_mplus_post", owner.id);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("concurrent");
  });

  it("frees a slot when a post is closed", async () => {
    const owner = await makeUser("owner");
    const cap = RATE_LIMITS.create_mplus_post.maxConcurrent!;
    for (let i = 0; i < cap; i++) await makeMPlusPost(owner.id);
    await prisma.mPlusRecruitmentPost.updateMany({
      where: { ownerUserId: owner.id },
      data: { createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    });

    const one = await prisma.mPlusRecruitmentPost.findFirst({ where: { ownerUserId: owner.id } });
    await prisma.mPlusRecruitmentPost.update({ where: { id: one!.id }, data: { status: "closed" } });

    expect((await checkLimit("create_mplus_post", owner.id)).allowed).toBe(true);
  });

  it("counts each user separately", async () => {
    const { applicant, character } = await makeApplyScenario();
    const owner = await makeUser("owner2");
    for (let i = 0; i < RATE_LIMITS.apply.perWindow; i++) {
      const post = await makeMPlusPost(owner.id);
      await createApplication(applicant.id, applyInput(post, character.id));
    }

    const innocent = await makeUser("innocent");
    expect((await checkLimit("apply", innocent.id)).allowed).toBe(true);
  });

  it("limits reports across different targets", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    for (let i = 0; i < RATE_LIMITS.report.perWindow; i++) {
      const post = await makeMPlusPost(owner.id);
      await createReport({
        reporterUserId: reporter.id,
        targetType: "mplus_post",
        targetId: post.id,
        category: "spam",
      });
    }
    expect((await checkLimit("report", reporter.id)).allowed).toBe(false);
  });
});
