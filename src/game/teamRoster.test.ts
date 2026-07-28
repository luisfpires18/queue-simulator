import { describe, it, expect } from "vitest";
import { openRoleSlots, PARTY_SIZE, rebuildOpenSlots, teamStatusForSlots } from "./teamRoster";

describe("openRoleSlots", () => {
  it("is a full 5-man party when nothing is taken", () => {
    expect(openRoleSlots([])).toEqual(["TANK", "HEALER", "DPS", "DPS", "DPS"]);
    expect(openRoleSlots([])).toHaveLength(PARTY_SIZE);
  });

  it("drops the leader's own role", () => {
    expect(openRoleSlots(["TANK"])).toEqual(["HEALER", "DPS", "DPS", "DPS"]);
    expect(openRoleSlots(["HEALER"])).toEqual(["TANK", "DPS", "DPS", "DPS"]);
    expect(openRoleSlots(["DPS"])).toEqual(["TANK", "HEALER", "DPS", "DPS"]);
  });

  it("subtracts every taken role, not just the first", () => {
    expect(openRoleSlots(["TANK", "HEALER", "DPS"])).toEqual(["DPS", "DPS"]);
  });

  it("is empty once the party is full", () => {
    expect(openRoleSlots(["TANK", "HEALER", "DPS", "DPS", "DPS"])).toEqual([]);
  });

  it("never goes negative when a role is over-filled", () => {
    expect(openRoleSlots(["TANK", "TANK", "TANK"])).toEqual(["HEALER", "DPS", "DPS", "DPS"]);
  });

  it("ignores roles outside the party composition", () => {
    expect(openRoleSlots(["SUPPORT"])).toEqual(["TANK", "HEALER", "DPS", "DPS", "DPS"]);
  });

  it("always orders tank, then healer, then dps", () => {
    expect(openRoleSlots(["DPS", "DPS"])).toEqual(["TANK", "HEALER", "DPS"]);
  });
});

describe("rebuildOpenSlots", () => {
  it("gives a departing member's spot back", () => {
    // Was full (tank/healer/3 dps); a dps left.
    const slots = rebuildOpenSlots(["TANK", "HEALER", "DPS", "DPS"], []);
    expect(slots).toEqual([{ role: "DPS", prefs: [] }]);
  });

  it("keeps that role's existing spec preferences", () => {
    const existing = [{ role: "DPS", prefs: ["mage:fire"] }];
    expect(rebuildOpenSlots(["TANK", "HEALER", "DPS", "DPS"], existing)).toEqual([
      { role: "DPS", prefs: ["mage:fire"] },
    ]);
  });

  it("carries prefs across to a role that had no open slot left", () => {
    // Healer left; the healer prefs were trimmed away when they were accepted,
    // so there's nothing to carry and the new slot starts empty.
    expect(rebuildOpenSlots(["TANK", "DPS", "DPS", "DPS"], [])).toEqual([{ role: "HEALER", prefs: [] }]);
  });

  it("is empty while the roster is still full", () => {
    expect(rebuildOpenSlots(["TANK", "HEALER", "DPS", "DPS", "DPS"], [])).toEqual([]);
  });

  it("uses the first slot's prefs when a role has several", () => {
    const existing = [
      { role: "DPS", prefs: ["mage:fire"] },
      { role: "DPS", prefs: ["rogue:outlaw"] },
    ];
    const slots = rebuildOpenSlots(["TANK", "HEALER"], existing);
    expect(slots.filter((s) => s.role === "DPS").every((s) => s.prefs[0] === "mage:fire")).toBe(true);
  });
});

describe("teamStatusForSlots", () => {
  it("is full with no open slots", () => {
    expect(teamStatusForSlots([])).toBe("full");
  });

  it("is open with any open slot", () => {
    expect(teamStatusForSlots([{ role: "DPS" }])).toBe("open");
  });
});
