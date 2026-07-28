import { describe, it, expect } from "vitest";
import { MAX_REQ_RATING_FILTER, teamMatchesMaxRating, teamMatchesRoles, teamMatchesSpecs } from "./teamFilters";
import type { OpenSlot } from "@/data/dto";

const slot = (role: string, prefs: string[] = []): OpenSlot => ({ role, prefs });

describe("teamMatchesRoles", () => {
  it("matches everything when nothing is selected", () => {
    expect(teamMatchesRoles([slot("DPS")], new Set())).toBe(true);
    expect(teamMatchesRoles([], new Set())).toBe(true);
  });

  it("matches when any open slot is one of the selected roles", () => {
    expect(teamMatchesRoles([slot("TANK"), slot("DPS")], new Set(["DPS"]))).toBe(true);
  });

  it("rejects a team recruiting none of them", () => {
    expect(teamMatchesRoles([slot("TANK")], new Set(["HEALER"]))).toBe(false);
    expect(teamMatchesRoles([], new Set(["DPS"]))).toBe(false);
  });
});

describe("teamMatchesSpecs", () => {
  it("matches everything when nothing is selected", () => {
    expect(teamMatchesSpecs([slot("DPS", ["mage:fire"])], new Set())).toBe(true);
  });

  it("matches a slot that explicitly ranks the spec", () => {
    expect(teamMatchesSpecs([slot("DPS", ["mage:fire", "rogue:outlaw"])], new Set(["rogue:outlaw"]))).toBe(true);
  });

  it("rejects a slot that ranks other specs only", () => {
    expect(teamMatchesSpecs([slot("DPS", ["mage:fire"])], new Set(["rogue:outlaw"]))).toBe(false);
  });

  it("matches an unranked slot of the same role - it accepts anyone", () => {
    expect(teamMatchesSpecs([slot("DPS")], new Set(["rogue:outlaw"]))).toBe(true);
  });

  it("does not let an unranked slot match a spec of a different role", () => {
    expect(teamMatchesSpecs([slot("TANK")], new Set(["rogue:outlaw"]))).toBe(false);
  });

  it("matches when any one of several selected specs fits", () => {
    expect(teamMatchesSpecs([slot("HEALER", ["priest:holy"])], new Set(["mage:fire", "priest:holy"]))).toBe(true);
  });

  it("rejects a team with no open slots at all", () => {
    expect(teamMatchesSpecs([], new Set(["mage:fire"]))).toBe(false);
  });
});

describe("teamMatchesMaxRating", () => {
  const rated = (reqRating: number) => ({ requirementType: "rating", reqRating });

  it("matches everything at the top of the slider", () => {
    expect(teamMatchesMaxRating(rated(5000), MAX_REQ_RATING_FILTER)).toBe(true);
  });

  it("keeps teams at or under the bar", () => {
    expect(teamMatchesMaxRating(rated(2500), 3000)).toBe(true);
    expect(teamMatchesMaxRating(rated(3000), 3000)).toBe(true);
  });

  it("drops teams asking for more", () => {
    expect(teamMatchesMaxRating(rated(3200), 3000)).toBe(false);
  });

  it("always keeps teams with no rating requirement", () => {
    expect(teamMatchesMaxRating({ requirementType: null, reqRating: null }, 0)).toBe(true);
    // A "resilient" requirement isn't a rating gate, so this filter ignores it.
    expect(teamMatchesMaxRating({ requirementType: "resilient", reqRating: null }, 0)).toBe(true);
  });
});
