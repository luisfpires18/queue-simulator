import { describe, it, expect } from "vitest";
import { isExpired } from "./groups";

describe("isExpired", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const graceMs = 2 * 60 * 60 * 1000; // 2h

  it("is never expired when startsAt is null (\"forming now\")", () => {
    expect(isExpired(null, now, graceMs)).toBe(false);
  });

  it("is not expired when startsAt is still in the future", () => {
    const startsAt = new Date("2026-01-01T13:00:00Z");
    expect(isExpired(startsAt, now, graceMs)).toBe(false);
  });

  it("is not expired within the grace window right after startsAt passes", () => {
    const startsAt = new Date("2026-01-01T11:00:00Z"); // 1h ago, grace is 2h
    expect(isExpired(startsAt, now, graceMs)).toBe(false);
  });

  it("is expired once startsAt + grace has passed", () => {
    const startsAt = new Date("2026-01-01T09:00:00Z"); // 3h ago, grace is 2h
    expect(isExpired(startsAt, now, graceMs)).toBe(true);
  });

  it("is expired right at the exact cutoff boundary", () => {
    const startsAt = new Date(now.getTime() - graceMs - 1);
    expect(isExpired(startsAt, now, graceMs)).toBe(true);
  });
});
