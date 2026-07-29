import { describe, it, expect } from "vitest";
import { isStartInPast, isStartTooFarOut, START_PAST_GRACE_MS, START_FUTURE_LIMIT_MS } from "./scheduling";

describe("isStartInPast", () => {
  const now = new Date("2026-01-01T14:17:00Z").getTime();
  const at = (ms: number) => new Date(now + ms).toISOString();

  it("accepts now and anything later", () => {
    expect(isStartInPast(at(0), now)).toBe(false);
    expect(isStartInPast(at(60_000), now)).toBe(false);
    expect(isStartInPast(at(6 * 60 * 60 * 1000), now)).toBe(false);
  });

  it("rejects a time that has clearly passed", () => {
    expect(isStartInPast(at(-10 * 60 * 1000), now)).toBe(true);
  });

  it("tolerates only the grace window, for clock skew and submit latency", () => {
    expect(isStartInPast(at(-START_PAST_GRACE_MS + 1000), now)).toBe(false);
    expect(isStartInPast(at(-START_PAST_GRACE_MS - 1000), now)).toBe(true);
  });

  it("never rejects \"forming now\", which has no time to be past", () => {
    expect(isStartInPast(null, now)).toBe(false);
    expect(isStartInPast(undefined, now)).toBe(false);
  });
});

describe("isStartTooFarOut", () => {
  const now = new Date("2026-01-01T14:17:00Z").getTime();
  const at = (ms: number) => new Date(now + ms).toISOString();

  it("allows anything within the window, covering every timezone's today", () => {
    expect(isStartTooFarOut(at(START_FUTURE_LIMIT_MS - 1000), now)).toBe(false);
  });

  it("rejects beyond it", () => {
    expect(isStartTooFarOut(at(START_FUTURE_LIMIT_MS + 1000), now)).toBe(true);
  });

  it("ignores \"forming now\"", () => {
    expect(isStartTooFarOut(null, now)).toBe(false);
  });
});

import { startsConflict } from "./scheduling";

const NOW = new Date("2026-07-19T18:00:00.000Z");
const iso = (offsetMinutes: number) => new Date(NOW.getTime() + offsetMinutes * 60000).toISOString();

describe("startsConflict", () => {
  it("two forming-now listings always conflict", () => {
    expect(startsConflict(null, null, NOW)).toBe(true);
  });

  it("forming-now conflicts with a listing starting within the hour", () => {
    expect(startsConflict(null, iso(45), NOW)).toBe(true);
  });

  it("forming-now does not conflict with a listing starting well outside the hour", () => {
    expect(startsConflict(null, iso(180), NOW)).toBe(false);
  });

  it("exactly one hour apart still conflicts (inclusive boundary)", () => {
    expect(startsConflict(null, iso(60), NOW)).toBe(true);
  });

  it("just over one hour apart does not conflict", () => {
    expect(startsConflict(null, iso(61), NOW)).toBe(false);
  });

  it("two scheduled listings close together conflict regardless of 'now'", () => {
    expect(startsConflict(iso(120), iso(150), NOW)).toBe(true);
  });

  it("order of arguments doesn't matter", () => {
    expect(startsConflict(iso(45), null, NOW)).toBe(true);
  });
});
