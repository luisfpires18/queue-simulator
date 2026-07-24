import { describe, it, expect } from "vitest";
import { pickNextOwner } from "./chatGroups";

describe("pickNextOwner", () => {
  function member(userId: string, joinedAt: string) {
    return { userId, joinedAt: new Date(joinedAt) };
  }

  it("returns null when the leaver was the only member", () => {
    const members = [member("A", "2026-01-01")];
    expect(pickNextOwner(members, "A")).toBeNull();
  });

  it("picks the earliest-joined remaining member", () => {
    const members = [
      member("A", "2026-01-01"),
      member("B", "2026-02-01"),
      member("C", "2026-01-15"),
    ];
    expect(pickNextOwner(members, "A")).toBe("C");
  });

  it("ignores the leaver's own joinedAt when picking among the rest", () => {
    const members = [member("A", "2025-01-01"), member("B", "2026-01-01")];
    expect(pickNextOwner(members, "A")).toBe("B");
  });

  it("is unaffected by array order", () => {
    const members = [member("C", "2026-03-01"), member("A", "2026-01-01"), member("B", "2026-02-01")];
    expect(pickNextOwner(members, "C")).toBe("A");
  });
});
