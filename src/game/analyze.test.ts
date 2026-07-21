import { describe, it, expect } from "vitest";
import { analyzeGroup, type Member } from "./analyze";

const M = (specId: string, rating = 3000): Member => ({ specId, rating });

describe("role counting", () => {
  it("recognizes a valid 1/1/3", () => {
    const a = analyzeGroup([
      M("druid:guardian"),
      M("monk:mistweaver"),
      M("demonhunter:havoc"),
      M("deathknight:unholy"),
      M("evoker:augmentation"),
    ]);
    expect(a.roles).toEqual({ tank: 1, healer: 1, dps: 3 });
    expect(a.rolesOk).toBe(true);
  });

  it("flags missing roles on a partial group", () => {
    const a = analyzeGroup([M("demonhunter:havoc"), M("deathknight:unholy")]);
    expect(a.rolesOk).toBe(false);
    expect(a.needs.some((n) => n.text.toLowerCase().includes("tank"))).toBe(true);
    expect(a.needs.some((n) => n.text.toLowerCase().includes("healer"))).toBe(true);
  });
});

describe("bloodlust coverage", () => {
  it("no lust among bear/mw/dh/dk -> flagged", () => {
    const a = analyzeGroup([
      M("druid:guardian"),
      M("monk:mistweaver"),
      M("demonhunter:havoc"),
      M("deathknight:unholy"),
    ]);
    expect(a.lust).toBe(false);
    expect(a.needs.some((n) => /bloodlust/i.test(n.text))).toBe(true);
  });

  it("adding an Evoker provides lust", () => {
    const a = analyzeGroup([
      M("druid:guardian"),
      M("monk:mistweaver"),
      M("demonhunter:havoc"),
      M("deathknight:unholy"),
      M("evoker:augmentation"),
    ]);
    expect(a.lust).toBe(true);
    expect(a.needs.some((n) => /bloodlust/i.test(n.text))).toBe(false);
  });

  it("a Mage also provides lust", () => {
    const a = analyzeGroup([M("mage:frost")]);
    expect(a.lust).toBe(true);
  });
});

describe("combat res coverage", () => {
  it("Druid provides battle res", () => {
    const a = analyzeGroup([M("druid:guardian")]);
    expect(a.combatRes).toBe(true);
  });

  it("group with no res provider is flagged", () => {
    const a = analyzeGroup([M("mage:frost"), M("monk:mistweaver"), M("demonhunter:havoc")]);
    expect(a.combatRes).toBe(false);
    expect(a.needs.some((n) => /battle res/i.test(n.text))).toBe(true);
  });

  it("DK, Warlock, Paladin all count as res", () => {
    expect(analyzeGroup([M("deathknight:unholy")]).combatRes).toBe(true);
    expect(analyzeGroup([M("warlock:affliction")]).combatRes).toBe(true);
    expect(analyzeGroup([M("paladin:retribution")]).combatRes).toBe(true);
  });
});

describe("archetype detection", () => {
  it("the S1 title comp reads as Meta with high confidence", () => {
    const a = analyzeGroup([
      M("druid:guardian"),
      M("monk:mistweaver"),
      M("demonhunter:devourer"),
      M("deathknight:unholy"),
      M("evoker:augmentation"),
    ]);
    expect(a.archetype.id).toBe("meta");
    expect(a.archetype.confidence).toBeGreaterThanOrEqual(90);
  });

  it("warrior + enhance + ww reads as Physical", () => {
    const a = analyzeGroup([
      M("warrior:protection"),
      M("shaman:restoration"),
      M("warrior:arms"),
      M("shaman:enhancement"),
      M("monk:windwalker"),
    ]);
    expect(a.archetype.id).toBe("physical");
  });

  it("a random spread is Off-meta", () => {
    const a = analyzeGroup([
      M("paladin:protection"),
      M("priest:holy"),
      M("mage:fire"),
      M("warlock:destruction"),
      M("hunter:beastmastery"),
    ]);
    expect(a.archetype.id).toBe("offmeta");
  });
});

describe("completeness + rating tier", () => {
  it("valid roles + lust + res = complete", () => {
    const a = analyzeGroup([
      M("druid:guardian"),
      M("shaman:restoration"),
      M("demonhunter:havoc"),
      M("deathknight:unholy"),
      M("evoker:augmentation"),
    ]);
    expect(a.complete).toBe(true);
  });

  it("avg rating maps to the right tier", () => {
    // "artifact" is the top tier in RATING_TIERS (src/game/season.ts). This
    // previously asserted "legend", an id that does not exist there - the only
    // "legend" in the codebase is an unused tier.legend colour token in
    // tailwind.config.ts, so the assertion could never have passed.
    const a = analyzeGroup([M("mage:frost", 4100), M("druid:guardian", 4100)]);
    expect(a.ratingTier.id).toBe("artifact");
  });

  it("averages the party rating rather than taking the best", () => {
    // 3000 and 1000 average to 2000, which is "epic" (>= 2080 is legendary,
    // so this lands one tier below) - not the 3000 player's "artifact".
    const a = analyzeGroup([M("mage:frost", 3000), M("druid:guardian", 1000)]);
    expect(a.ratingTier.id).toBe("rare");
  });

  it("falls back to the lowest tier for an unrated group", () => {
    const a = analyzeGroup([M("mage:frost", 0), M("druid:guardian", 0)]);
    expect(a.ratingTier.id).toBe("uncommon");
  });
});
