import { describe, it, expect } from "vitest";
import { scoreGroupForQueueEntry, pickBestGroup, type QueueCandidateGroup } from "./soloQueue";

const forming = (over: Partial<QueueCandidateGroup> = {}): QueueCandidateGroup => ({
  id: "g1",
  kind: "mplus",
  status: "forming",
  reqRating: null,
  keyLevel: 20,
  dungeonId: "mgt",
  slots: [{ role: "DPS", prefs: [] }],
  members: [],
  ...over,
});

describe("scoreGroupForQueueEntry", () => {
  it("rejects raid groups (M+ only scope)", () => {
    const g = forming({ kind: "raid" });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 3000)).toBeNull();
  });

  it("rejects non-forming groups", () => {
    const g = forming({ status: "delisted" });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 3000)).toBeNull();
  });

  it("rejects when there's no open slot for the role", () => {
    const g = forming({ slots: [{ role: "TANK", prefs: [] }] });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 3000)).toBeNull();
  });

  it("rejects when the open slot has a spec preference that excludes this spec", () => {
    const g = forming({ slots: [{ role: "DPS", prefs: ["shaman:enhancement"] }] });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 3000)).toBeNull();
  });

  it("accepts when the open slot's spec preference includes this spec", () => {
    const g = forming({ slots: [{ role: "DPS", prefs: ["warrior:fury"] }] });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 3000)).not.toBeNull();
  });

  it("rejects when below the group's rating requirement", () => {
    const g = forming({ reqRating: 3000 });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 2000)).toBeNull();
  });

  it("rejects an unrated character against a group with a rating requirement", () => {
    const g = forming({ reqRating: 3000 });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, null)).toBeNull();
  });

  it("accepts at or above the group's rating requirement", () => {
    const g = forming({ reqRating: 3000 });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury" }, 3000)).not.toBeNull();
  });

  it("rejects a key level below the entry's minKeyLevel filter", () => {
    const g = forming({ keyLevel: 10 });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury", minKeyLevel: 15 }, 3000)).toBeNull();
  });

  it("rejects a key level above the entry's maxKeyLevel filter", () => {
    const g = forming({ keyLevel: 25 });
    expect(scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury", maxKeyLevel: 20 }, 3000)).toBeNull();
  });

  it("accepts a key level within the entry's min/max filter range", () => {
    const g = forming({ keyLevel: 18 });
    expect(
      scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury", minKeyLevel: 15, maxKeyLevel: 20 }, 3000)
    ).not.toBeNull();
  });

  it("rejects a dungeon not in the entry's dungeonIds filter", () => {
    const g = forming({ dungeonId: "voj" });
    expect(
      scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury", dungeonIds: ["mgt"] }, 3000)
    ).toBeNull();
  });

  it("accepts a dungeon that is in the entry's dungeonIds filter", () => {
    const g = forming({ dungeonId: "mgt" });
    expect(
      scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury", dungeonIds: ["mgt", "voj"] }, 3000)
    ).not.toBeNull();
  });

  it("an empty dungeonIds filter means any dungeon is accepted", () => {
    const g = forming({ dungeonId: "voj" });
    expect(
      scoreGroupForQueueEntry(g, { role: "DPS", specId: "warrior:fury", dungeonIds: [] }, 3000)
    ).not.toBeNull();
  });

  it("scores a specific spec preference higher than an open 'any' slot", () => {
    const open = forming({ slots: [{ role: "DPS", prefs: [] }] });
    const specific = forming({ slots: [{ role: "DPS", prefs: ["warrior:fury"] }] });
    const entry = { role: "DPS", specId: "warrior:fury" };
    const openScore = scoreGroupForQueueEntry(open, entry, 3000)!;
    const specificScore = scoreGroupForQueueEntry(specific, entry, 3000)!;
    expect(specificScore).toBeGreaterThan(openScore);
  });
});

describe("pickBestGroup", () => {
  it("returns null when no candidate group can take the entry", () => {
    const groups = [forming({ id: "a", kind: "raid" }), forming({ id: "b", status: "delisted" })];
    expect(pickBestGroup(groups, { role: "DPS", specId: "warrior:fury" }, 3000)).toBeNull();
  });

  it("picks the higher-scoring viable group", () => {
    const groups = [
      forming({ id: "open", slots: [{ role: "DPS", prefs: [] }] }),
      forming({ id: "specific", slots: [{ role: "DPS", prefs: ["warrior:fury"] }] }),
    ];
    const best = pickBestGroup(groups, { role: "DPS", specId: "warrior:fury" }, 3000);
    expect(best?.id).toBe("specific");
  });
});
