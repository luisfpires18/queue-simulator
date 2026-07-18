import { describe, it, expect } from "vitest";
import { selectBestRuns, type RunMemberRow } from "./runs";

function row(over: Partial<RunMemberRow> = {}): RunMemberRow {
  return {
    characterId: "char-1",
    specId: 577,
    dungeonId: 161,
    keyLevel: 10,
    score: 300,
    completedAt: new Date("2026-07-15T00:00:00Z"),
    ...over,
  };
}

describe("selectBestRuns", () => {
  it("picks the highest-score run when the same character/spec/dungeon appears twice", () => {
    const rows = [row({ score: 300 }), row({ score: 450 }), row({ score: 100 })];
    const best = selectBestRuns(rows);
    expect(best).toHaveLength(1);
    expect(best[0].score).toBe(450);
  });

  it("keeps different specs on the same dungeon separate", () => {
    const rows = [row({ specId: 577, score: 300 }), row({ specId: 1480, score: 500 })];
    const best = selectBestRuns(rows);
    expect(best).toHaveLength(2);
    expect(best.find((r) => r.specId === 577)?.score).toBe(300);
    expect(best.find((r) => r.specId === 1480)?.score).toBe(500);
  });

  it("keeps different dungeons separate", () => {
    const rows = [row({ dungeonId: 161, score: 300 }), row({ dungeonId: 239, score: 300 })];
    const best = selectBestRuns(rows);
    expect(best).toHaveLength(2);
  });

  it("keeps different characters separate", () => {
    const rows = [row({ characterId: "char-1", score: 300 }), row({ characterId: "char-2", score: 999 })];
    const best = selectBestRuns(rows);
    expect(best).toHaveLength(2);
    expect(best.find((r) => r.characterId === "char-2")?.score).toBe(999);
  });

  it("falls back to key level when score is null (both runs unscored)", () => {
    const rows = [row({ score: null, keyLevel: 10 }), row({ score: null, keyLevel: 20 })];
    const best = selectBestRuns(rows);
    expect(best).toHaveLength(1);
    expect(best[0].keyLevel).toBe(20);
  });

  it("drops rows with no matching character (not one of our tracked characters)", () => {
    const rows = [row({ characterId: null, score: 999 }), row({ characterId: "char-1", score: 100 })];
    const best = selectBestRuns(rows);
    expect(best).toHaveLength(1);
    expect(best[0].score).toBe(100);
  });

  it("returns an empty array for a character with zero runs", () => {
    expect(selectBestRuns([])).toEqual([]);
  });
});
