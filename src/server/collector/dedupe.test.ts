import { describe, it, expect } from "vitest";
import { computeDedupeKey } from "./dedupe";

describe("computeDedupeKey", () => {
  const base = {
    dungeonId: 161,
    connectedRealmId: 1080,
    completedAt: 1784153931000,
    memberBlizzardCharacterIds: [219808000, 189434662, 174644085, 165908658, 172950183],
  };

  it("returns the same key for the same run re-polled later", () => {
    expect(computeDedupeKey(base)).toBe(computeDedupeKey({ ...base }));
  });

  it("is independent of member order (Blizzard doesn't guarantee a stable order)", () => {
    const shuffled = { ...base, memberBlizzardCharacterIds: [...base.memberBlizzardCharacterIds].reverse() };
    expect(computeDedupeKey(base)).toBe(computeDedupeKey(shuffled));
  });

  it("differs when the dungeon differs", () => {
    expect(computeDedupeKey(base)).not.toBe(computeDedupeKey({ ...base, dungeonId: 239 }));
  });

  it("differs when the connected realm differs", () => {
    expect(computeDedupeKey(base)).not.toBe(computeDedupeKey({ ...base, connectedRealmId: 1081 }));
  });

  it("differs when the completion time differs", () => {
    expect(computeDedupeKey(base)).not.toBe(computeDedupeKey({ ...base, completedAt: base.completedAt + 1000 }));
  });

  it("differs when the party members differ", () => {
    const otherMembers = { ...base, memberBlizzardCharacterIds: [1, 2, 3, 4, 5] };
    expect(computeDedupeKey(base)).not.toBe(computeDedupeKey(otherMembers));
  });

  it("prefers a stable blizzardRunId over the composite key when one exists", () => {
    const withId = computeDedupeKey({ ...base, blizzardRunId: "abc123" });
    const otherWithSameId = computeDedupeKey({ ...base, connectedRealmId: 9999, blizzardRunId: "abc123" });
    expect(withId).toBe(otherWithSameId);
    expect(withId).toContain("abc123");
  });
});
