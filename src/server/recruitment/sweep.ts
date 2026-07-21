// Expiry sweep for recruitment listings and applications.
//
// Reads have always been lazy about expiry - browse filters on
// `expiresAt > now`, and effectiveStatus() reports a stale application as
// expired without writing. That is correct but leaves the table telling a
// different story from the UI: a post can read "expired" for months while its
// status column still says "open". This makes the stored state catch up.
//
// Deliberately CLOSES rather than deletes. A recruiter coming back after a
// break should find their post paused-and-refreshable, not gone - and an
// applicant should still see what happened to an application that timed out.
// Nothing here destroys user data.
import { prisma } from "@/lib/prisma";
import { APPLICATION_TTL_DAYS } from "@/game/applicationStatus";

export interface SweepResult {
  mplusPostsClosed: number;
  raidTeamsClosed: number;
  raiderProfilesClosed: number;
  applicationsExpired: number;
}

/** Statuses still considered live. A post the owner already closed, or one
 * already marked expired, must not be touched again - otherwise every sweep
 * rewrites the same rows forever. */
const LIVE_LISTING_STATUSES = ["open", "paused"];
const LIVE_APPLICATION_STATUSES = ["pending", "shortlisted", "trial_offered", "trial_accepted", "under_review", "interview_requested", "trial_active"];

export async function sweepExpired(now: Date = new Date()): Promise<SweepResult> {
  const applicationCutoff = new Date(now.getTime() - APPLICATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Independent updateMany calls rather than one transaction: each is
  // idempotent and order does not matter, so a partial run just means the
  // next sweep finishes the job.
  const [mplus, teams, profiles, applications] = await Promise.all([
    prisma.mPlusRecruitmentPost.updateMany({
      where: { expiresAt: { lte: now }, status: { in: LIVE_LISTING_STATUSES } },
      data: { status: "expired" },
    }),
    prisma.raidTeam.updateMany({
      where: { expiresAt: { lte: now }, status: { in: LIVE_LISTING_STATUSES } },
      data: { status: "expired" },
    }),
    prisma.raiderProfile.updateMany({
      where: { expiresAt: { lte: now }, status: { in: LIVE_LISTING_STATUSES } },
      data: { status: "expired" },
    }),
    // An application expires on inactivity, not on a stored expiresAt - it has
    // no such column, and updatedAt is what the lazy effectiveStatus() reads.
    prisma.recruitmentApplication.updateMany({
      where: { updatedAt: { lte: applicationCutoff }, status: { in: LIVE_APPLICATION_STATUSES } },
      data: { status: "expired" },
    }),
  ]);

  return {
    mplusPostsClosed: mplus.count,
    raidTeamsClosed: teams.count,
    raiderProfilesClosed: profiles.count,
    applicationsExpired: applications.count,
  };
}

