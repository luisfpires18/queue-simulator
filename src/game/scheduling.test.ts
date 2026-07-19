import { describe, it, expect } from "vitest";
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
