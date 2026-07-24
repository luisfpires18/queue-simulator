import { describe, it, expect } from "vitest";
import { computeFriendshipStatus, pickDisplayCharacter } from "./network";

describe("computeFriendshipStatus", () => {
  const A = "user-a";
  const B = "user-b";

  it("returns none when there are no rows", () => {
    expect(computeFriendshipStatus([], A, B)).toBe("none");
  });

  it("returns friends once accepted", () => {
    const rows = [{ requesterUserId: A, addresseeUserId: B, status: "accepted", createdAt: new Date("2026-01-01") }];
    expect(computeFriendshipStatus(rows, A, B)).toBe("friends");
    expect(computeFriendshipStatus(rows, B, A)).toBe("friends");
  });

  it("returns pending_outgoing for the requester and pending_incoming for the addressee", () => {
    const rows = [{ requesterUserId: A, addresseeUserId: B, status: "pending", createdAt: new Date("2026-01-01") }];
    expect(computeFriendshipStatus(rows, A, B)).toBe("pending_outgoing");
    expect(computeFriendshipStatus(rows, B, A)).toBe("pending_incoming");
  });

  it("ignores declined rows", () => {
    const rows = [{ requesterUserId: A, addresseeUserId: B, status: "declined", createdAt: new Date("2026-01-01") }];
    expect(computeFriendshipStatus(rows, A, B)).toBe("none");
  });

  it("a fresh pending request after a decline takes priority (most recent non-declined row wins)", () => {
    const rows = [
      { requesterUserId: A, addresseeUserId: B, status: "declined", createdAt: new Date("2026-01-01") },
      { requesterUserId: B, addresseeUserId: A, status: "pending", createdAt: new Date("2026-02-01") },
    ];
    expect(computeFriendshipStatus(rows, A, B)).toBe("pending_incoming");
  });
});

describe("pickDisplayCharacter", () => {
  function char(over: Partial<Parameters<typeof pickDisplayCharacter>[0][number]> = {}) {
    return {
      name: "Alt", realm: "Realm", realmSlug: "realm", region: "eu", classId: "warrior", faction: "Alliance",
      isMain: false, bucket: "alt", sortOrder: 0, level: 80,
      ...over,
    };
  }

  it("returns null when there are no visible characters", () => {
    expect(pickDisplayCharacter([])).toBeNull();
    expect(pickDisplayCharacter([char({ bucket: "hidden" })])).toBeNull();
  });

  it("prefers the main character over others", () => {
    const alt = char({ name: "Alt", sortOrder: 0 });
    const main = char({ name: "Main", isMain: true, sortOrder: 5 });
    expect(pickDisplayCharacter([alt, main])?.name).toBe("Main");
  });

  it("falls back to sortOrder/level/name ordering when there's no main", () => {
    const b = char({ name: "Bravo", sortOrder: 1 });
    const a = char({ name: "Alpha", sortOrder: 0 });
    expect(pickDisplayCharacter([b, a])?.name).toBe("Alpha");
  });

  it("excludes hidden characters even when they'd otherwise sort first", () => {
    const hidden = char({ name: "Secret", bucket: "hidden", sortOrder: -1 });
    const alt = char({ name: "Alt", sortOrder: 0 });
    expect(pickDisplayCharacter([hidden, alt])?.name).toBe("Alt");
  });
});
