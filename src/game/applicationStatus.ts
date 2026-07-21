// The recruitment-application state machine. Pure, no I/O.
//
// Two things make this worth having as its own module rather than a few ifs in
// the data layer: WHICH side is allowed to make a transition is a security
// rule (an applicant must never be able to accept themselves), and the legal
// transitions differ between M+ and guild recruitment. Both are far easier to
// prove correct as a table than as branching code.

export type RecruitmentType = "mplus" | "guild";

/** Who is asking for the transition. The applicant and the recruiting side
 * have almost disjoint permissions. */
export type Actor = "applicant" | "recruiter";

export type ApplicationStatus =
  // shared
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired"
  // mplus
  | "shortlisted"
  | "trial_offered"
  | "trial_accepted"
  // guild
  | "under_review"
  | "interview_requested"
  | "trial_active";

export const MPLUS_STATUSES: readonly ApplicationStatus[] = [
  "pending",
  "shortlisted",
  "trial_offered",
  "trial_accepted",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
];

export const GUILD_STATUSES: readonly ApplicationStatus[] = [
  "pending",
  "under_review",
  "interview_requested",
  "trial_offered",
  "trial_active",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pending",
  shortlisted: "Shortlisted",
  under_review: "Under review",
  interview_requested: "Interview requested",
  trial_offered: "Trial offered",
  trial_accepted: "Trial accepted",
  trial_active: "Trial active",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

/** Short sentence for the applicant's status timeline - the label alone does
 * not say what happens next. */
export const STATUS_HINT: Record<ApplicationStatus, string> = {
  pending: "Waiting for the team to review your application.",
  shortlisted: "The team has shortlisted you.",
  under_review: "The guild is reviewing your application.",
  interview_requested: "The guild would like to talk to you.",
  trial_offered: "You have been offered a trial. Accept it to continue.",
  trial_accepted: "You accepted the trial.",
  trial_active: "Your trial is underway.",
  accepted: "You are in.",
  declined: "This application was declined.",
  withdrawn: "You withdrew this application.",
  expired: "This application expired without a decision.",
};

/** Nothing transitions out of these. Kept as one set because every caller
 * asking "can this still change" means all four. */
const TERMINAL: readonly ApplicationStatus[] = ["accepted", "declined", "withdrawn", "expired"];

export function isTerminal(status: string): boolean {
  return TERMINAL.includes(status as ApplicationStatus);
}

export function isActive(status: string): boolean {
  return !isTerminal(status);
}

/** Legal transitions per recruitment type, as {from: to[]}.
 *
 * Read the tables as the recruiter's funnel plus two escape hatches available
 * from any live state: the recruiter can always decline, and the applicant can
 * always withdraw. `expired` is reachable only by the system, so it appears in
 * no `to` list here - shouldExpire() drives it instead. */
const MPLUS_TRANSITIONS: Partial<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  pending: ["shortlisted", "trial_offered", "accepted", "declined", "withdrawn"],
  shortlisted: ["trial_offered", "accepted", "declined", "withdrawn"],
  trial_offered: ["trial_accepted", "accepted", "declined", "withdrawn"],
  trial_accepted: ["accepted", "declined", "withdrawn"],
};

const GUILD_TRANSITIONS: Partial<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  pending: ["under_review", "interview_requested", "trial_offered", "accepted", "declined", "withdrawn"],
  under_review: ["interview_requested", "trial_offered", "accepted", "declined", "withdrawn"],
  interview_requested: ["trial_offered", "accepted", "declined", "withdrawn"],
  trial_offered: ["trial_active", "accepted", "declined", "withdrawn"],
  trial_active: ["accepted", "declined", "withdrawn"],
};

/** Which side may move an application INTO each status.
 *
 * The security-relevant entries: only the applicant can withdraw (a recruiter
 * silently withdrawing on someone's behalf would hide a rejection), only the
 * applicant can accept a trial that was offered to them, and only the
 * recruiter can accept - which is what actually puts someone on a roster. */
const ALLOWED_ACTOR: Record<ApplicationStatus, readonly Actor[]> = {
  pending: ["applicant"],
  shortlisted: ["recruiter"],
  under_review: ["recruiter"],
  interview_requested: ["recruiter"],
  trial_offered: ["recruiter"],
  trial_accepted: ["applicant"],
  trial_active: ["recruiter"],
  accepted: ["recruiter"],
  declined: ["recruiter"],
  withdrawn: ["applicant"],
  expired: [],
};

export function statusesFor(recruitmentType: string): readonly ApplicationStatus[] {
  return recruitmentType === "guild" ? GUILD_STATUSES : MPLUS_STATUSES;
}

/** Is `to` a legal next status from `from` for this recruitment type, ignoring
 * who is asking? Use canActorTransition for the authorization question. */
export function canTransition(from: string, to: string, recruitmentType: string): boolean {
  if (from === to) return false; // a no-op is not a transition; callers should not write
  if (isTerminal(from)) return false;
  if (!statusesFor(recruitmentType).includes(to as ApplicationStatus)) return false;

  const table = recruitmentType === "guild" ? GUILD_TRANSITIONS : MPLUS_TRANSITIONS;
  return (table[from as ApplicationStatus] ?? []).includes(to as ApplicationStatus);
}

/** The full gate: legal transition AND this actor is allowed to make it.
 * This is what the data layer calls - never canTransition alone. */
export function canActorTransition(
  from: string,
  to: string,
  recruitmentType: string,
  actor: Actor
): boolean {
  if (!canTransition(from, to, recruitmentType)) return false;
  return (ALLOWED_ACTOR[to as ApplicationStatus] ?? []).includes(actor);
}

/** Everything `actor` could legally do next - drives which buttons render, so
 * the UI can never offer an action the server will reject. */
export function nextStatuses(from: string, recruitmentType: string, actor: Actor): ApplicationStatus[] {
  const table = recruitmentType === "guild" ? GUILD_TRANSITIONS : MPLUS_TRANSITIONS;
  return (table[from as ApplicationStatus] ?? []).filter((to) =>
    (ALLOWED_ACTOR[to] ?? []).includes(actor)
  );
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/** An application nobody acts on goes stale. Longer than the 14-day M+ post
 * TTL on purpose: the post expiring is what usually ends the conversation, and
 * an application outliving its post by a couple of weeks is harmless. */
export const APPLICATION_TTL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Only ever true for a live application - an accepted one is not "expired"
 * three months later, it is still accepted. */
export function shouldExpire(
  application: { status: string; updatedAt: string | Date },
  now: Date = new Date()
): boolean {
  if (isTerminal(application.status)) return false;
  const updated =
    application.updatedAt instanceof Date ? application.updatedAt.getTime() : Date.parse(application.updatedAt);
  return now.getTime() - updated >= APPLICATION_TTL_DAYS * DAY_MS;
}

/** Status as the reader should see it, applying expiry lazily. Nothing sweeps
 * the table (see the phase's known limitations), so a stale row reads as
 * expired without a write having happened. */
export function effectiveStatus(
  application: { status: string; updatedAt: string | Date },
  now: Date = new Date()
): string {
  return shouldExpire(application, now) ? "expired" : application.status;
}
