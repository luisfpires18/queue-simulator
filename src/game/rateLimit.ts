// Rate-limit policy. Pure - no I/O, no clock of its own.
//
// Deliberately has NO storage of its own. The counters are the real rows:
// "how many applications did you create in the last hour" is a query against
// RecruitmentApplication, not a separate tally that can drift from it, go
// stale, or be lost on restart. That rules out an in-memory limiter, which
// resets on every deploy - exactly when someone hammering the API would
// benefit most.
//
// Two different controls, because they stop different things:
//   - RATE  (per window): stops bursts. "20 applications an hour."
//   - CONCURRENT (live rows): stops accumulation, and is immune to the
//     delete-and-recreate trick that defeats a pure rate window. "at most 30
//     live applications at once."

export interface RateLimitPolicy {
  /** Max creations inside `windowMs`. */
  perWindow: number;
  windowMs: number;
  /** Max rows that may exist in a live state at one time. Omitted where the
   * concept does not apply (a report is not "live"). */
  maxConcurrent?: number;
  /** Shown to the user when they hit it - phrased as a limit, not an
   * accusation, since almost everyone who sees this is legitimate. */
  message: string;
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export type RateLimitedAction =
  | "apply"
  | "create_mplus_post"
  | "create_guild"
  | "create_raid_team"
  | "create_raider_profile"
  | "report";

/** Ceilings, not targets. Every number here is well above what an engaged
 * real user does in a day, so hitting one is a signal rather than an
 * inconvenience. */
export const RATE_LIMITS: Record<RateLimitedAction, RateLimitPolicy> = {
  apply: {
    perWindow: 20,
    windowMs: HOUR_MS,
    maxConcurrent: 30,
    message: "You have sent a lot of applications recently. Try again in a little while.",
  },
  create_mplus_post: {
    perWindow: 5,
    windowMs: HOUR_MS,
    maxConcurrent: 10,
    message: "You have created several recruitment posts recently. Try again in a little while.",
  },
  create_guild: {
    perWindow: 3,
    windowMs: DAY_MS,
    maxConcurrent: 5,
    message: "You have created several guilds recently. Try again tomorrow.",
  },
  create_raid_team: {
    perWindow: 5,
    windowMs: HOUR_MS,
    maxConcurrent: 20,
    message: "You have created several raid teams recently. Try again in a little while.",
  },
  create_raider_profile: {
    perWindow: 5,
    windowMs: HOUR_MS,
    maxConcurrent: 10,
    message: "You have created several raider profiles recently. Try again in a little while.",
  },
  report: {
    perWindow: 10,
    windowMs: HOUR_MS,
    message: "You have sent a lot of reports recently. Try again in a little while.",
  },
};

export interface RateLimitVerdict {
  allowed: boolean;
  /** Which control tripped, so the caller can log the difference between a
   * burst and an accumulation. */
  reason?: "rate" | "concurrent";
  message?: string;
  /** Milliseconds until the oldest in-window action ages out. Only meaningful
   * for a "rate" refusal - a concurrent cap clears when the user deletes
   * something, not when time passes. */
  retryAfterMs?: number;
}

const ALLOWED: RateLimitVerdict = { allowed: true };

/** The whole decision, given counts the caller has already fetched.
 *
 * `oldestInWindowAt` is optional: without it the caller just cannot report a
 * precise retry time, which is a nicety rather than a requirement. */
export function checkRateLimit(
  action: RateLimitedAction,
  counts: { inWindow: number; concurrent?: number; oldestInWindowAt?: Date | string | null },
  now: Date = new Date()
): RateLimitVerdict {
  const policy = RATE_LIMITS[action];

  if (policy.maxConcurrent !== undefined && (counts.concurrent ?? 0) >= policy.maxConcurrent) {
    return {
      allowed: false,
      reason: "concurrent",
      // Distinct wording: waiting will not help, so saying "try again later"
      // would send the user in circles.
      message: `You already have ${policy.maxConcurrent} of these open. Close or withdraw one first.`,
    };
  }

  if (counts.inWindow >= policy.perWindow) {
    return {
      allowed: false,
      reason: "rate",
      message: policy.message,
      retryAfterMs: retryAfter(counts.oldestInWindowAt, policy.windowMs, now),
    };
  }

  return ALLOWED;
}

function retryAfter(
  oldest: Date | string | null | undefined,
  windowMs: number,
  now: Date
): number | undefined {
  if (!oldest) return undefined;
  const t = oldest instanceof Date ? oldest.getTime() : Date.parse(oldest);
  if (!Number.isFinite(t)) return undefined;
  return Math.max(0, t + windowMs - now.getTime());
}

/** The start of the current window, for the caller's `createdAt >= ` query. */
export function windowStart(action: RateLimitedAction, now: Date = new Date()): Date {
  return new Date(now.getTime() - RATE_LIMITS[action].windowMs);
}

/** Whole seconds, for a Retry-After header. */
export function retryAfterSeconds(verdict: RateLimitVerdict): number | undefined {
  return verdict.retryAfterMs === undefined ? undefined : Math.ceil(verdict.retryAfterMs / 1000);
}
