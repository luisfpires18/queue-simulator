import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { countOpenReports, createReport, listReports, setReportStatus } from "@/data/moderation";
import { makeGuildTeam, makeMPlusPost, makeUser } from "./fixtures";

// The allowlist gate itself is pure and tested in
// src/game/adminAllowlist.test.ts - it must not import auth, so it cannot live
// here. This file covers the DB-backed queue.

describe("report queue", () => {
  it("lists open reports with a readable target label", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);

    await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "boosting",
      detail: "selling runs",
    });

    const reports = await listReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].targetLabel).toBe("Test Team");
    expect(reports[0].category).toBe("boosting");
    // Flat, not nested: the route and the page consume the identical shape.
    expect(reports[0].reporterBattletag).toContain("reporter");
    expect(typeof reports[0].createdAt).toBe("string");
  });

  it("labels a raid team through its guild", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const { guild, team } = await makeGuildTeam(owner.id);

    await createReport({
      reporterUserId: reporter.id,
      targetType: "raid_team",
      targetId: team.id,
      category: "spam",
    });

    const reports = await listReports();
    expect(reports[0].targetLabel).toBe(`${guild.name} - Main raid`);
  });

  it("reports a deleted target as gone rather than failing", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "spam",
    });
    await prisma.mPlusRecruitmentPost.delete({ where: { id: post.id } });

    const reports = await listReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].targetLabel).toBeNull();
  });

  it("drops a report out of the open queue once handled", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    const report = await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "spam",
    });

    expect(await countOpenReports()).toBe(1);
    await setReportStatus(report.id, "actioned");
    expect(await countOpenReports()).toBe(0);
    expect(await listReports()).toHaveLength(0);
  });

  it("records when a report was reviewed", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    const report = await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "spam",
    });

    expect(report.reviewedAt).toBeNull();
    const updated = await setReportStatus(report.id, "reviewed");
    expect(updated.reviewedAt).toBeInstanceOf(Date);
  });

  it("clears the reviewed stamp if a report is reopened", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    const report = await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "spam",
    });

    await setReportStatus(report.id, "dismissed");
    const reopened = await setReportStatus(report.id, "open");
    expect(reopened.reviewedAt).toBeNull();
  });

  it("can return the full history including handled reports", async () => {
    const reporter = await makeUser("reporter");
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    const report = await createReport({
      reporterUserId: reporter.id,
      targetType: "mplus_post",
      targetId: post.id,
      category: "spam",
    });
    await setReportStatus(report.id, "actioned");

    expect(await listReports({ status: null })).toHaveLength(1);
  });
});
