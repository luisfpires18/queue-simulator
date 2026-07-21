// Rate-limit enforcement: turns the pure policy in src/game/rateLimit.ts into
// real counts and a 429.
//
// Every count is a query against the rows the action actually creates, so
// there is no separate tally to drift, expire, or lose on restart. The cost is
// one indexed count per mutating request, which is acceptable because these
// are all low-frequency actions (applying, posting, reporting) and none of
// them is on a read path.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  retryAfterSeconds,
  windowStart,
  type RateLimitVerdict,
  type RateLimitedAction,
} from "@/game/rateLimit";

/** Statuses that still occupy a "live application" slot for the concurrent
 * cap. A withdrawn or declined application is history and should not count
 * against you forever. */
const LIVE_APPLICATION_STATUSES = { notIn: ["accepted", "declined", "withdrawn", "expired"] };

/** Runs the counts for one action and applies the policy. */
export async function checkLimit(
  action: RateLimitedAction,
  userId: string,
  now: Date = new Date()
): Promise<RateLimitVerdict> {
  const since = windowStart(action, now);

  switch (action) {
    case "apply": {
      const [inWindow, concurrent, oldest] = await Promise.all([
        prisma.recruitmentApplication.count({
          where: { applicantUserId: userId, createdAt: { gte: since } },
        }),
        prisma.recruitmentApplication.count({
          where: { applicantUserId: userId, status: LIVE_APPLICATION_STATUSES },
        }),
        oldestCreatedAt(() =>
          prisma.recruitmentApplication.findFirst({
            where: { applicantUserId: userId, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        ),
      ]);
      return checkRateLimit(action, { inWindow, concurrent, oldestInWindowAt: oldest }, now);
    }

    case "create_mplus_post": {
      const [inWindow, concurrent, oldest] = await Promise.all([
        prisma.mPlusRecruitmentPost.count({ where: { ownerUserId: userId, createdAt: { gte: since } } }),
        // "Live" means still listed. A closed post is not occupying anything.
        prisma.mPlusRecruitmentPost.count({
          where: { ownerUserId: userId, status: { notIn: ["closed"] } },
        }),
        oldestCreatedAt(() =>
          prisma.mPlusRecruitmentPost.findFirst({
            where: { ownerUserId: userId, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        ),
      ]);
      return checkRateLimit(action, { inWindow, concurrent, oldestInWindowAt: oldest }, now);
    }

    case "create_guild": {
      const [inWindow, concurrent, oldest] = await Promise.all([
        prisma.guild.count({ where: { ownerUserId: userId, createdAt: { gte: since } } }),
        prisma.guild.count({ where: { ownerUserId: userId } }),
        oldestCreatedAt(() =>
          prisma.guild.findFirst({
            where: { ownerUserId: userId, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        ),
      ]);
      return checkRateLimit(action, { inWindow, concurrent, oldestInWindowAt: oldest }, now);
    }

    case "create_raid_team": {
      const where = { guild: { ownerUserId: userId } };
      const [inWindow, concurrent, oldest] = await Promise.all([
        prisma.raidTeam.count({ where: { ...where, createdAt: { gte: since } } }),
        prisma.raidTeam.count({ where }),
        oldestCreatedAt(() =>
          prisma.raidTeam.findFirst({
            where: { ...where, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        ),
      ]);
      return checkRateLimit(action, { inWindow, concurrent, oldestInWindowAt: oldest }, now);
    }

    case "create_raider_profile": {
      const [inWindow, concurrent, oldest] = await Promise.all([
        prisma.raiderProfile.count({ where: { ownerUserId: userId, createdAt: { gte: since } } }),
        prisma.raiderProfile.count({ where: { ownerUserId: userId } }),
        oldestCreatedAt(() =>
          prisma.raiderProfile.findFirst({
            where: { ownerUserId: userId, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        ),
      ]);
      return checkRateLimit(action, { inWindow, concurrent, oldestInWindowAt: oldest }, now);
    }

    case "report": {
      const [inWindow, oldest] = await Promise.all([
        prisma.report.count({ where: { reporterUserId: userId, createdAt: { gte: since } } }),
        oldestCreatedAt(() =>
          prisma.report.findFirst({
            where: { reporterUserId: userId, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        ),
      ]);
      return checkRateLimit(action, { inWindow, oldestInWindowAt: oldest }, now);
    }
  }
}

async function oldestCreatedAt(
  query: () => Promise<{ createdAt: Date } | null>
): Promise<Date | null> {
  return (await query())?.createdAt ?? null;
}

/** The canonical 429. Carries Retry-After when waiting will actually help -
 * a concurrent-cap refusal deliberately omits it, because time does not clear
 * that one. */
export function rateLimited(verdict: RateLimitVerdict) {
  const seconds = retryAfterSeconds(verdict);
  return NextResponse.json(
    { error: verdict.message ?? "Too many requests. Try again later." },
    {
      status: 429,
      ...(seconds !== undefined ? { headers: { "Retry-After": String(seconds) } } : {}),
    }
  );
}

/** One-liner for route handlers: returns a 429 Response to return early, or
 * null to continue. */
export async function enforceLimit(
  action: RateLimitedAction,
  userId: string
): Promise<NextResponse | null> {
  const verdict = await checkLimit(action, userId);
  return verdict.allowed ? null : rateLimited(verdict);
}
