import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  HOUR_MS,
  RATE_LIMITS,
  checkRateLimit,
  retryAfterSeconds,
  windowStart,
} from "./rateLimit";

const NOW = new Date("2026-07-20T12:00:00Z");

describe("policy shape", () => {
  it("defines a limit for every action", () => {
    for (const [action, policy] of Object.entries(RATE_LIMITS)) {
      expect(policy.perWindow, action).toBeGreaterThan(0);
      expect(policy.windowMs, action).toBeGreaterThan(0);
      expect(policy.message, action).toBeTruthy();
    }
  });

  it("sets limits well above ordinary use, so hitting one is a signal", () => {
    // A real person does not apply to 20 teams an hour. If these ever drop to
    // single digits, legitimate users start seeing 429s.
    expect(RATE_LIMITS.apply.perWindow).toBeGreaterThanOrEqual(10);
    expect(RATE_LIMITS.apply.maxConcurrent).toBeGreaterThanOrEqual(20);
  });
});

describe("checkRateLimit - rate window", () => {
  it("allows a first action", () => {
    expect(checkRateLimit("apply", { inWindow: 0, concurrent: 0 }, NOW).allowed).toBe(true);
  });

  it("allows right up to the limit", () => {
    const limit = RATE_LIMITS.apply.perWindow;
    expect(checkRateLimit("apply", { inWindow: limit - 1, concurrent: 0 }, NOW).allowed).toBe(true);
  });

  it("refuses at the limit", () => {
    const limit = RATE_LIMITS.apply.perWindow;
    const v = checkRateLimit("apply", { inWindow: limit, concurrent: 0 }, NOW);
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("rate");
    expect(v.message).toBe(RATE_LIMITS.apply.message);
  });

  it("refuses past the limit", () => {
    expect(checkRateLimit("apply", { inWindow: 999, concurrent: 0 }, NOW).allowed).toBe(false);
  });

  it("reports when the oldest action ages out", () => {
    const oldest = new Date(NOW.getTime() - 20 * 60 * 1000); // 20 minutes ago
    const v = checkRateLimit(
      "apply",
      { inWindow: RATE_LIMITS.apply.perWindow, concurrent: 0, oldestInWindowAt: oldest },
      NOW
    );
    // One hour window, 20 minutes elapsed, so 40 minutes left.
    expect(v.retryAfterMs).toBe(40 * 60 * 1000);
  });

  it("omits a retry time when the oldest timestamp is unknown", () => {
    const v = checkRateLimit("apply", { inWindow: 999, concurrent: 0 }, NOW);
    expect(v.retryAfterMs).toBeUndefined();
  });

  it("accepts an ISO string as well as a Date", () => {
    const oldest = new Date(NOW.getTime() - 30 * 60 * 1000).toISOString();
    const v = checkRateLimit(
      "apply",
      { inWindow: RATE_LIMITS.apply.perWindow, concurrent: 0, oldestInWindowAt: oldest },
      NOW
    );
    expect(v.retryAfterMs).toBe(30 * 60 * 1000);
  });

  it("never reports a negative retry time", () => {
    const oldest = new Date(NOW.getTime() - 5 * HOUR_MS);
    const v = checkRateLimit(
      "apply",
      { inWindow: RATE_LIMITS.apply.perWindow, concurrent: 0, oldestInWindowAt: oldest },
      NOW
    );
    expect(v.retryAfterMs).toBe(0);
  });
});

describe("checkRateLimit - concurrent cap", () => {
  it("refuses once too many are live, even with no recent activity", () => {
    // The case a pure rate window misses: create, delete, create, delete...
    // never trips a per-hour counter but accumulates live rows.
    const v = checkRateLimit(
      "apply",
      { inWindow: 0, concurrent: RATE_LIMITS.apply.maxConcurrent! },
      NOW
    );
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("concurrent");
  });

  it("tells the user to close one rather than to wait", () => {
    const v = checkRateLimit("apply", { inWindow: 0, concurrent: 99 }, NOW);
    expect(v.message).toContain("Close or withdraw one");
    // Waiting does not clear a concurrent cap, so offering a retry time would
    // send the user in circles.
    expect(v.retryAfterMs).toBeUndefined();
  });

  it("takes precedence over the rate refusal when both trip", () => {
    const v = checkRateLimit("apply", { inWindow: 999, concurrent: 999 }, NOW);
    expect(v.reason).toBe("concurrent");
  });

  it("is skipped for actions that have no concurrent concept", () => {
    // A report is not "live" - only the rate window applies.
    expect(RATE_LIMITS.report.maxConcurrent).toBeUndefined();
    expect(checkRateLimit("report", { inWindow: 0, concurrent: 9999 }, NOW).allowed).toBe(true);
  });

  it("treats a missing concurrent count as zero", () => {
    expect(checkRateLimit("apply", { inWindow: 0 }, NOW).allowed).toBe(true);
  });
});

describe("windowStart", () => {
  it("goes back one hour for hourly actions", () => {
    expect(windowStart("apply", NOW).toISOString()).toBe("2026-07-20T11:00:00.000Z");
  });

  it("goes back a day for daily actions", () => {
    expect(RATE_LIMITS.create_guild.windowMs).toBe(DAY_MS);
    expect(windowStart("create_guild", NOW).toISOString()).toBe("2026-07-19T12:00:00.000Z");
  });
});

describe("retryAfterSeconds", () => {
  it("rounds up to whole seconds for the header", () => {
    expect(retryAfterSeconds({ allowed: false, retryAfterMs: 1500 })).toBe(2);
  });

  it("is undefined when there is no retry time", () => {
    expect(retryAfterSeconds({ allowed: false })).toBeUndefined();
  });
});
