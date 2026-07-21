import { describe, it, expect } from "vitest";
import {
  M_PLUS_TTL_DAYS,
  GUILD_TTL_DAYS,
  ttlDays,
  computeExpiry,
  isExpired,
  isStale,
  daysUntilExpiry,
  formatExpiry,
  formatListingAge,
  statusAfterPositionChange,
  type ExpirableListing,
} from "./expiry";

const NOW = new Date("2026-07-20T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/** A listing refreshed `daysAgo` days before NOW, with the expiry that implies. */
const listing = (daysAgo: number, ttl: number): ExpirableListing => {
  const refreshedAt = new Date(NOW.getTime() - daysAgo * DAY_MS);
  return {
    refreshedAt: refreshedAt.toISOString(),
    expiresAt: new Date(refreshedAt.getTime() + ttl * DAY_MS).toISOString(),
  };
};

describe("ttlDays", () => {
  it("gives M+ posts a 14 day life", () => {
    expect(M_PLUS_TTL_DAYS).toBe(14);
    expect(ttlDays("mplus")).toBe(14);
  });

  it("gives guild posts a 30 day life, since rosters move slower", () => {
    expect(GUILD_TTL_DAYS).toBe(30);
    expect(ttlDays("guild")).toBe(30);
  });
});

describe("computeExpiry", () => {
  it("adds the M+ TTL", () => {
    expect(computeExpiry(NOW, "mplus").toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });

  it("adds the guild TTL", () => {
    expect(computeExpiry(NOW, "guild").toISOString()).toBe("2026-08-19T12:00:00.000Z");
  });

  it("moves forward when a post is refreshed later", () => {
    const first = computeExpiry(NOW, "mplus");
    const later = computeExpiry(new Date(NOW.getTime() + 5 * DAY_MS), "mplus");
    expect(later.getTime()).toBeGreaterThan(first.getTime());
  });
});

describe("isExpired", () => {
  it("is false for a fresh post", () => {
    expect(isExpired(listing(0, 14), NOW)).toBe(false);
  });

  it("is false one day before expiry", () => {
    expect(isExpired(listing(13, 14), NOW)).toBe(false);
  });

  it("is true exactly at expiry", () => {
    expect(isExpired(listing(14, 14), NOW)).toBe(true);
  });

  it("is true past expiry", () => {
    expect(isExpired(listing(20, 14), NOW)).toBe(true);
  });

  it("does not expire a guild post at the M+ deadline", () => {
    expect(isExpired(listing(20, GUILD_TTL_DAYS), NOW)).toBe(false);
  });
});

describe("isStale", () => {
  it("is false in the first half of a post's life", () => {
    expect(isStale(listing(3, 14), "mplus", NOW)).toBe(false);
  });

  it("is true past the halfway point", () => {
    expect(isStale(listing(10, 14), "mplus", NOW)).toBe(true);
  });

  it("is false once expired, since expired is its own state", () => {
    expect(isStale(listing(20, 14), "mplus", NOW)).toBe(false);
  });

  it("scales the stale window with the listing kind", () => {
    // 10 days in: past halfway for M+, nowhere near it for a guild.
    expect(isStale(listing(10, M_PLUS_TTL_DAYS), "mplus", NOW)).toBe(true);
    expect(isStale(listing(10, GUILD_TTL_DAYS), "guild", NOW)).toBe(false);
  });

  it("resets when the post is refreshed", () => {
    const stale = listing(10, 14);
    expect(isStale(stale, "mplus", NOW)).toBe(true);
    const refreshed: ExpirableListing = {
      refreshedAt: NOW.toISOString(),
      expiresAt: computeExpiry(NOW, "mplus").toISOString(),
    };
    expect(isStale(refreshed, "mplus", NOW)).toBe(false);
  });
});

describe("daysUntilExpiry", () => {
  it("counts the days left", () => {
    expect(daysUntilExpiry(listing(4, 14), NOW)).toBe(10);
  });

  it("never goes negative", () => {
    expect(daysUntilExpiry(listing(40, 14), NOW)).toBe(0);
  });
});

describe("formatExpiry", () => {
  it("names an expired post", () => {
    expect(formatExpiry(listing(20, 14), NOW)).toBe("Expired");
  });

  it("collapses the final day", () => {
    expect(formatExpiry(listing(13, 14), NOW)).toBe("Expires today");
  });

  it("counts remaining days", () => {
    expect(formatExpiry(listing(4, 14), NOW)).toBe("Expires in 10 days");
  });
});

describe("formatListingAge", () => {
  it("renders minutes-old posts as just now", () => {
    expect(formatListingAge(new Date(NOW.getTime() - 5 * 60 * 1000), NOW)).toBe("Just now");
  });

  it("renders hours", () => {
    expect(formatListingAge(new Date(NOW.getTime() - 3 * 60 * 60 * 1000), NOW)).toBe("3 hours ago");
    expect(formatListingAge(new Date(NOW.getTime() - 60 * 60 * 1000), NOW)).toBe("1 hour ago");
  });

  it("renders days", () => {
    expect(formatListingAge(new Date(NOW.getTime() - 5 * DAY_MS), NOW)).toBe("5 days ago");
    expect(formatListingAge(new Date(NOW.getTime() - DAY_MS), NOW)).toBe("1 day ago");
  });
});

describe("statusAfterPositionChange", () => {
  it("closes a post once every position is filled", () => {
    expect(statusAfterPositionChange("open", [{ isFilled: true }, { isFilled: true }])).toBe("filled");
  });

  it("leaves a post open while any position is unfilled", () => {
    expect(statusAfterPositionChange("open", [{ isFilled: true }, { isFilled: false }])).toBe("open");
  });

  it("reopens a filled-then-vacated post", () => {
    expect(statusAfterPositionChange("open", [{ isFilled: false }])).toBe("open");
  });

  it("never overrides a status the owner set deliberately", () => {
    expect(statusAfterPositionChange("paused", [{ isFilled: true }])).toBe("paused");
    expect(statusAfterPositionChange("closed", [{ isFilled: true }])).toBe("closed");
  });

  it("leaves a post with no positions alone, since there is nothing to fill", () => {
    expect(statusAfterPositionChange("open", [])).toBe("open");
  });
});
