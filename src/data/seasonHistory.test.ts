import { describe, it, expect } from "vitest";
import { parseSnapshotSpecTracks } from "./seasonHistory";

describe("parseSnapshotSpecTracks", () => {
  it("returns [] for malformed input", () => {
    expect(parseSnapshotSpecTracks("not json")).toEqual([]);
    expect(parseSnapshotSpecTracks("{}")).toEqual([]);
    expect(parseSnapshotSpecTracks("[]")).toEqual([]);
  });

  it("parses a well-formed snapshot spec track, defaulting missing fields", () => {
    const raw = JSON.stringify([{ specId: "warrior:protection", role: "TANK", bnetScore: 3200 }]);
    expect(parseSnapshotSpecTracks(raw)).toEqual([
      { specId: "warrior:protection", role: "TANK", points: null, bnetScore: 3200, isMain: false, bestRuns: [] },
    ]);
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify([{ role: "TANK" }, { specId: "warrior:protection", role: "TANK" }]);
    expect(parseSnapshotSpecTracks(raw)).toHaveLength(1);
  });

  it("preserves nested bestRuns", () => {
    const bestRuns = [{ dungeonId: 1, dungeonName: "Test", level: 15, score: 300, timed: true, completedAt: 123 }];
    const raw = JSON.stringify([{ specId: "warrior:protection", role: "TANK", bestRuns }]);
    expect(parseSnapshotSpecTracks(raw)[0].bestRuns).toEqual(bestRuns);
  });
});
