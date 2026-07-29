// Pure scheduling logic. No I/O - mirrors analyze.ts/soloQueue.ts.

const CONFLICT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * How far into the past a submitted start time may sit before it's rejected.
 *
 * Not zero: the client picks a time, then spends a moment on the rest of the
 * form, and its clock may differ from the server's. Small enough that no
 * genuinely past slot is selectable - a minute back, not fifteen.
 */
export const START_PAST_GRACE_MS = 2 * 60 * 1000;

/** A picked start only makes sense within roughly "today" for whoever
 * submitted it - generous enough to cover any timezone's today. */
export const START_FUTURE_LIMIT_MS = 48 * 60 * 60 * 1000;

/** True when a start time is too far in the past to accept. Shared by the
 * listing forms and the zod schema so both apply the identical rule. */
export function isStartInPast(startsAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!startsAt) return false; // "forming now" has no time to be past
  return new Date(startsAt).getTime() < now - START_PAST_GRACE_MS;
}

/** True when a start time is further out than the board supports. */
export function isStartTooFarOut(startsAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!startsAt) return false;
  return new Date(startsAt).getTime() > now + START_FUTURE_LIMIT_MS;
}

/** Two listings collide for "you can only run one key at a time" purposes if
 * their effective start times fall within an hour of each other - not just
 * when both are literally "forming now" (startsAt null). A null startsAt
 * means "starting right now" relative to `now`, so two forming-now listings
 * always collide (0 minutes apart), while a listing starting a few hours out
 * doesn't. */
export function startsConflict(aStartsAt: string | null, bStartsAt: string | null, now: Date = new Date()): boolean {
  const a = aStartsAt ? new Date(aStartsAt).getTime() : now.getTime();
  const b = bStartsAt ? new Date(bStartsAt).getTime() : now.getTime();
  return Math.abs(a - b) <= CONFLICT_WINDOW_MS;
}
