import { describe, it, expect } from "vitest";
import { seasonById, SEASONS, DEFAULT_SEASON_ID } from "./season";

describe("seasonById", () => {
  it("finds a known season by id", () => {
    expect(seasonById("midnight-s2").season).toBe(2);
  });

  it("falls back to the first season for an unknown id", () => {
    expect(seasonById("not-a-real-season")).toBe(SEASONS[0]);
  });

  it("DEFAULT_SEASON_ID resolves to a real season", () => {
    expect(seasonById(DEFAULT_SEASON_ID).id).toBe(DEFAULT_SEASON_ID);
  });
});
