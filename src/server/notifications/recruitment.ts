// Recruitment notification triggers.
//
// Kept beside dispatch.ts rather than inside the data layer so src/data stays
// free of transport concerns, and so every recruitment push shares one place
// to get its wording and target-resolution right.
//
// All of these go through notifyUserTyped: direct to one person (the message
// needs data the registry cannot see), but still honouring a per-type opt-out
// from the profile Notifications tab. They default to ON, unlike the opt-in
// broadcast that "a new key was listed" uses - see the registry entries.
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL, type ApplicationStatus } from "@/game/applicationStatus";
import { notifyUserTyped } from "./dispatch";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";

/** Where a notification about this application should land the recipient. */
function targetUrl(app: { recruitmentType: string; targetId: string }): string {
  return app.recruitmentType === "guild" ? `/guilds?tab=applications` : `/recruitment/${app.targetId}`;
}

/** Resolves the owner of whichever listing this application points at.
 * targetId addresses one of two tables (see the schema note), so this mirrors
 * loadTarget in the data layer. */
async function resolveTarget(
  recruitmentType: string,
  targetId: string
): Promise<{ ownerUserId: string; title: string } | null> {
  if (recruitmentType === "guild") {
    const team = await prisma.raidTeam.findUnique({
      where: { id: targetId },
      select: { name: true, guild: { select: { ownerUserId: true, name: true } } },
    });
    return team ? { ownerUserId: team.guild.ownerUserId, title: `${team.guild.name} - ${team.name}` } : null;
  }
  const post = await prisma.mPlusRecruitmentPost.findUnique({
    where: { id: targetId },
    select: { ownerUserId: true, title: true, teamName: true },
  });
  return post ? { ownerUserId: post.ownerUserId, title: post.teamName || post.title } : null;
}

/** To the listing owner, when someone applies. */
export async function notifyApplicationReceived(app: RecruitmentApplicationDTO): Promise<void> {
  const target = await resolveTarget(app.recruitmentType, app.targetId);
  if (!target) return;

  await notifyUserTyped(target.ownerUserId, "recruitment_application_received", {
    title: "New application",
    body: `${app.character.name} applied to "${target.title}".`,
    url: targetUrl(app),
  });
}

/** To the applicant, when the recruiter moves their application.
 *
 * Skipped for withdrawn: the applicant did that themselves, and telling
 * someone what they just did is noise. */
export async function notifyApplicationStatus(app: RecruitmentApplicationDTO): Promise<void> {
  if (app.status === "withdrawn") return;

  const target = await resolveTarget(app.recruitmentType, app.targetId);
  if (!target) return;

  const label = STATUS_LABEL[app.status as ApplicationStatus] ?? app.status;

  // Trial offers get their own wording because they need an action from the
  // applicant, unlike every other status which is just news.
  const isTrialOffer = app.status === "trial_offered";

  // A trial offer is its own opt-out: it needs an action from the applicant,
  // so someone who muted routine status churn may still want this one.
  await notifyUserTyped(
    app.applicantUserId,
    isTrialOffer ? "recruitment_trial_offered" : "recruitment_application_status",
    {
      title: isTrialOffer ? "Trial offered" : `Application ${label.toLowerCase()}`,
      body: isTrialOffer
        ? `"${target.title}" offered you a trial. Accept it to continue.`
        : `Your application to "${target.title}" is now ${label.toLowerCase()}.`,
      url: app.recruitmentType === "guild" ? "/guilds?tab=applications" : "/recruitment?tab=applications",
    }
  );
}

/** To the listing owner, when accepting the final opening auto-closes their
 * post. Worth its own push: the post silently leaving browse is otherwise
 * invisible until they go looking. */
export async function notifyPositionsFilled(app: RecruitmentApplicationDTO): Promise<void> {
  const target = await resolveTarget(app.recruitmentType, app.targetId);
  if (!target) return;

  await notifyUserTyped(target.ownerUserId, "recruitment_position_filled", {
    title: "Recruitment complete",
    body: `All positions on "${target.title}" are filled, so it is no longer listed.`,
    url: targetUrl(app),
  });
}
