import { describe, it, expect } from "vitest";
import { highestCharacterRating } from "./rating";

describe("highestCharacterRating", () => {
  it("returns null for an empty roster", () => {
    expect(highestCharacterRating([])).toBeNull();
  });

  it("returns null when nobody has a rating yet", () => {
    expect(highestCharacterRating([{ rating: null }, { rating: null }])).toBeNull();
  });

  it("picks the max across the roster, not just the first entry", () => {
    expect(highestCharacterRating([{ rating: 1500 }, { rating: 3200 }, { rating: 2000 }])).toBe(3200);
  });

  it("ignores unrated characters mixed in with rated ones", () => {
    expect(highestCharacterRating([{ rating: null }, { rating: 1800 }])).toBe(1800);
  });
});
