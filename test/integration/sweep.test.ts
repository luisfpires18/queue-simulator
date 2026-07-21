import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { sweepExpired } from "@/server/recruitment/sweep";
import { refreshMPlusPost } from "@/data/mplusRecruitment";
import { listMPlusPosts } from "@/data/mplusRecruitment";
import { createApplication } from "@/data/recruitmentApplications";
import { APPLICATION_TTL_DAYS } from "@/game/applicationStatus";
import { applyInput, makeApplyScenario, makeGuildTeam, makeMPlusPost, makeUser } from "./fixtures";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe("sweepExpired - listings", () => {
  it("marks a lapsed M+ post expired", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { expiresAt: daysAgo(1) });

    const result = await sweepExpired();
    expect(result.mplusPostsClosed).toBe(1);

    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("expired");
  });

  it("leaves a live post alone", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);

    await sweepExpired();
    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("open");
  });

  it("sweeps a paused post that lapsed, since paused is still live", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { status: "paused", expiresAt: daysAgo(1) });

    await sweepExpired();
    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("expired");
  });

  it("does not touch a post the owner deliberately closed", async () => {
    // Closing was a decision; expiry is a lapse. Overwriting one with the
    // other would lose that distinction.
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { status: "closed", expiresAt: daysAgo(1) });

    await sweepExpired();
    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("closed");
  });

  it("does not touch a filled post", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { status: "filled", expiresAt: daysAgo(1) });

    await sweepExpired();
    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("filled");
  });

  it("is idempotent - a second run changes nothing", async () => {
    const owner = await makeUser("owner");
    await makeMPlusPost(owner.id, { expiresAt: daysAgo(1) });

    expect((await sweepExpired()).mplusPostsClosed).toBe(1);
    expect((await sweepExpired()).mplusPostsClosed).toBe(0);
  });

  it("expires a lapsed raid team", async () => {
    const owner = await makeUser("owner");
    const { team } = await makeGuildTeam(owner.id);
    await prisma.raidTeam.update({ where: { id: team.id }, data: { expiresAt: daysAgo(1) } });

    expect((await sweepExpired()).raidTeamsClosed).toBe(1);
    const row = await prisma.raidTeam.findUnique({ where: { id: team.id } });
    expect(row?.status).toBe("expired");
  });

  it("never deletes anything", async () => {
    const owner = await makeUser("owner");
    await makeMPlusPost(owner.id, { expiresAt: daysAgo(1) });

    await sweepExpired();
    // The row survives, just closed - a recruiter back from a break finds
    // their post refreshable rather than gone.
    expect(await prisma.mPlusRecruitmentPost.count()).toBe(1);
  });
});

describe("sweepExpired - applications", () => {
  it("expires an application nobody acted on", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await prisma.recruitmentApplication.update({
      where: { id: res.application.id },
      data: { updatedAt: daysAgo(APPLICATION_TTL_DAYS + 1) },
    });

    expect((await sweepExpired()).applicationsExpired).toBe(1);
    const row = await prisma.recruitmentApplication.findUnique({ where: { id: res.application.id } });
    expect(row?.status).toBe("expired");
  });

  it("leaves a recently-touched application alone", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await sweepExpired();
    const row = await prisma.recruitmentApplication.findUnique({ where: { id: res.application.id } });
    expect(row?.status).toBe("pending");
  });

  it("does not re-expire a settled application", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await prisma.recruitmentApplication.update({
      where: { id: res.application.id },
      data: { status: "accepted", updatedAt: daysAgo(400) },
    });

    await sweepExpired();
    const row = await prisma.recruitmentApplication.findUnique({ where: { id: res.application.id } });
    expect(row?.status).toBe("accepted");
  });
});

describe("refresh revives an expired listing", () => {
  it("puts an expired post back into browse", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { expiresAt: daysAgo(1) });
    await sweepExpired();

    // Gone from browse while expired.
    expect((await listMPlusPosts({})).map((p) => p.id)).not.toContain(post.id);

    await refreshMPlusPost(post.id);

    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("open");
    expect((await listMPlusPosts({})).map((p) => p.id)).toContain(post.id);
  });

  it("does not reopen a post the owner paused", async () => {
    // Refresh extends the clock; it must not override a deliberate choice.
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { status: "paused" });

    await refreshMPlusPost(post.id);
    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("paused");
  });

  it("does not reopen a filled post", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id, { status: "filled" });

    await refreshMPlusPost(post.id);
    const row = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(row?.status).toBe("filled");
  });
});
