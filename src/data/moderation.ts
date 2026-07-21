// Blocking and reporting.
//
// Ships alongside applications rather than after them: an application is the
// first thing in this app that lets one stranger contact another, so the means
// to stop that has to exist at the same moment, not one release later.
import { prisma } from "@/lib/prisma";
import type { ReportCategory, ReportTargetType } from "@/game/moderation";

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

/** Idempotent: blocking someone already blocked updates the reason rather than
 * erroring, so a double-tap in the UI is harmless. */
export async function blockUser(blockerUserId: string, blockedUserId: string, reason?: string | null) {
  if (blockerUserId === blockedUserId) {
    // Not an error worth surfacing - just refuse. Only reachable by a
    // hand-crafted request.
    return null;
  }
  return prisma.userBlock.upsert({
    where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
    create: { blockerUserId, blockedUserId, reason: reason ?? null },
    update: { reason: reason ?? null },
  });
}

export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await prisma.userBlock.deleteMany({ where: { blockerUserId, blockedUserId } });
}

/** Who this user has blocked - their own list, for a settings screen. There is
 * deliberately no "who blocked me" query: that would tell a blocked user they
 * were blocked, which is exactly what blocking is supposed to avoid. */
export async function listBlocks(blockerUserId: string) {
  return prisma.userBlock.findMany({ where: { blockerUserId }, orderBy: { createdAt: "desc" } });
}

/** True if EITHER user has blocked the other.
 *
 * Symmetric on purpose. A block has to stop contact in both directions: if it
 * only stopped the blocker from being contacted, the blocked user could still
 * receive applications from them, and if it only worked one way the blocker
 * would keep seeing the other person's applications. One query, both
 * directions, so no call site can accidentally check only half.
 *
 * This is the single chokepoint every apply path calls - do not inline a
 * one-directional check anywhere else. */
export async function isBlockedEither(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return false;
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userA, blockedUserId: userB },
        { blockerUserId: userB, blockedUserId: userA },
      ],
    },
    select: { id: true },
  });
  return !!row;
}

/** Every user id this user is cut off from, for filtering browse lists in one
 * pass rather than an is-blocked query per row. */
export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
    select: { blockerUserId: true, blockedUserId: true },
  });
  const out = new Set<string>();
  for (const r of rows) {
    out.add(r.blockerUserId === userId ? r.blockedUserId : r.blockerUserId);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** One report per user per target: re-reporting updates the existing row
 * rather than piling up, so a single determined user cannot inflate a target's
 * report count and manufacture the appearance of consensus. */
export async function createReport(input: {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  detail?: string | null;
}) {
  const { reporterUserId, targetType, targetId, category, detail } = input;
  return prisma.report.upsert({
    where: {
      reporterUserId_targetType_targetId: { reporterUserId, targetType, targetId },
    },
    create: { reporterUserId, targetType, targetId, category, detail: detail ?? null },
    // A re-report is a correction or an escalation, so the newer category and
    // detail win, and the row returns to "open" for a fresh look.
    update: { category, detail: detail ?? null, status: "open" },
  });
}

/** Has this user already reported this target? Drives the UI showing
 * "Reported" instead of re-offering the action. */
export async function hasReported(
  reporterUserId: string,
  targetType: ReportTargetType,
  targetId: string
): Promise<boolean> {
  const row = await prisma.report.findFirst({
    where: { reporterUserId, targetType, targetId },
    select: { id: true },
  });
  return !!row;
}

/** Reports for the moderation queue, newest first. Defaults to open ones,
 * which is the working view; `status: null` returns everything for history. */
export async function listReports(
  opts: { status?: string | null; limit?: number } = {}
): Promise<ReportWithContext[]> {
  const rows = await prisma.report.findMany({
    where: opts.status === null ? {} : { status: opts.status ?? "open" },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    include: { reporter: { select: { battletag: true } } },
  });

  // Resolve what each report points AT. targetId addresses one of several
  // tables (see the schema note), so this cannot be a join - and a moderator
  // reading "someone reported cmrt..." with no title has nothing to act on.
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      reporterUserId: r.reporterUserId,
      reporterBattletag: r.reporter.battletag,
      targetType: r.targetType,
      targetId: r.targetId,
      targetLabel: await describeTarget(r.targetType, r.targetId),
      category: r.category,
      detail: r.detail,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    }))
  );
}

/** Flattened and date-serialized at the source, so the API route and the page
 * hand the UI the same shape. Returning the raw row from one and a serialized
 * form from the other is how `reporter.battletag` and `reporterBattletag` end
 * up both existing and only one of them working. */
export interface ReportWithContext {
  id: string;
  reporterUserId: string;
  reporterBattletag: string | null;
  targetType: string;
  targetId: string;
  /** Human-readable name of the reported thing, or null if it is gone. */
  targetLabel: string | null;
  category: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

async function describeTarget(targetType: string, targetId: string): Promise<string | null> {
  switch (targetType) {
    case "mplus_post": {
      const p = await prisma.mPlusRecruitmentPost.findUnique({
        where: { id: targetId },
        select: { title: true, teamName: true },
      });
      return p ? p.teamName || p.title : null;
    }
    case "guild": {
      const g = await prisma.guild.findUnique({ where: { id: targetId }, select: { name: true } });
      return g?.name ?? null;
    }
    case "raid_team": {
      const t = await prisma.raidTeam.findUnique({
        where: { id: targetId },
        select: { name: true, guild: { select: { name: true } } },
      });
      return t ? `${t.guild.name} - ${t.name}` : null;
    }
    case "application": {
      const a = await prisma.recruitmentApplication.findUnique({
        where: { id: targetId },
        select: { character: { select: { name: true, realm: true } } },
      });
      return a ? `${a.character.name}-${a.character.realm}` : null;
    }
    case "user": {
      const u = await prisma.user.findUnique({ where: { id: targetId }, select: { battletag: true } });
      return u?.battletag ?? null;
    }
    default:
      return null;
  }
}

/** Moves a report out of the queue. Records WHEN it was reviewed so the
 * history shows response time, not just the outcome. */
export async function setReportStatus(reportId: string, status: string) {
  return prisma.report.update({
    where: { id: reportId },
    data: { status, reviewedAt: status === "open" ? null : new Date() },
  });
}

export async function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: "open" } });
}
