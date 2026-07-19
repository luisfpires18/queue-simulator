// Pure scheduling-conflict logic. No I/O - mirrors analyze.ts/soloQueue.ts.

const CONFLICT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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
