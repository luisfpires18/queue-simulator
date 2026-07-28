import { describe, it, expect } from "vitest";
import {
  groupSlotsByRole, roleBudgetFromSlots, rolesStillAvailable, setPrefsForRole,
} from "./slotGroups";

const slot = (role: string, prefs: string[] = []) => ({ role, prefs });

describe("groupSlotsByRole", () => {
  it("collapses a 5-man party into three pickers", () => {
    const groups = groupSlotsByRole([slot("TANK"), slot("HEALER"), slot("DPS"), slot("DPS"), slot("DPS")]);
    expect(groups.map((g) => [g.role, g.count])).toEqual([
      ["TANK", 1],
      ["HEALER", 1],
      ["DPS", 3],
    ]);
  });

  it("always orders tank, healer, dps regardless of slot order", () => {
    const groups = groupSlotsByRole([slot("DPS"), slot("TANK"), slot("HEALER")]);
    expect(groups.map((g) => g.role)).toEqual(["TANK", "HEALER", "DPS"]);
  });

  it("omits roles with no open slot", () => {
    expect(groupSlotsByRole([slot("DPS"), slot("DPS")]).map((g) => g.role)).toEqual(["DPS"]);
    expect(groupSlotsByRole([])).toEqual([]);
  });

  it("unions prefs across slots of the same role, first-seen order", () => {
    const groups = groupSlotsByRole([
      slot("DPS", ["warrior:fury", "mage:fire"]),
      slot("DPS", ["mage:fire", "rogue:outlaw"]),
    ]);
    expect(groups[0].prefs).toEqual(["warrior:fury", "mage:fire", "rogue:outlaw"]);
  });

  it("dedupes within a single slot too", () => {
    expect(groupSlotsByRole([slot("TANK", ["warrior:protection", "warrior:protection"])])[0].prefs)
      .toEqual(["warrior:protection"]);
  });

  it("keeps roles' prefs separate", () => {
    const groups = groupSlotsByRole([slot("TANK", ["warrior:protection"]), slot("DPS", ["mage:fire"])]);
    expect(groups.find((g) => g.role === "TANK")!.prefs).toEqual(["warrior:protection"]);
    expect(groups.find((g) => g.role === "DPS")!.prefs).toEqual(["mage:fire"]);
  });

  it("does not mutate the input slots", () => {
    const slots = [slot("DPS", ["mage:fire"]), slot("DPS", ["rogue:outlaw"])];
    groupSlotsByRole(slots);
    expect(slots[0].prefs).toEqual(["mage:fire"]);
  });
});

describe("setPrefsForRole", () => {
  it("writes the list onto every slot of that role", () => {
    const out = setPrefsForRole([slot("DPS"), slot("DPS"), slot("TANK")], "DPS", ["mage:fire"]);
    expect(out).toEqual([
      slot("DPS", ["mage:fire"]),
      slot("DPS", ["mage:fire"]),
      slot("TANK", []),
    ]);
  });

  it("is a no-op when no slot has that role", () => {
    const slots = [slot("TANK")];
    expect(setPrefsForRole(slots, "HEALER", ["priest:holy"])).toEqual(slots);
  });

  it("returns new objects rather than mutating", () => {
    const slots = [slot("DPS", ["mage:fire"])];
    const out = setPrefsForRole(slots, "DPS", ["rogue:outlaw"]);
    expect(slots[0].prefs).toEqual(["mage:fire"]);
    expect(out[0].prefs).toEqual(["rogue:outlaw"]);
  });
});

describe("roleBudgetFromSlots", () => {
  it("counts the open slots per role", () => {
    expect(roleBudgetFromSlots([slot("HEALER"), slot("DPS"), slot("DPS"), slot("DPS")]))
      .toEqual({ TANK: 0, HEALER: 1, DPS: 3 });
  });

  it("is all zeroes for a full roster", () => {
    expect(roleBudgetFromSlots([])).toEqual({ TANK: 0, HEALER: 0, DPS: 0 });
  });
});

describe("rolesStillAvailable", () => {
  // A tank listing a +key: 1 healer + 3 dps left, no tank spot at all.
  const tankLeading = { TANK: 0, HEALER: 1, DPS: 3 };
  // A dps listing one: the other two dps are still open, not three.
  const dpsLeading = { TANK: 1, HEALER: 1, DPS: 2 };

  it("never offers the role the leader already fills", () => {
    expect(rolesStillAvailable(tankLeading, [])).toEqual(["HEALER", "DPS"]);
  });

  it("still offers the leader's role when the party wants more of it", () => {
    expect(rolesStillAvailable(dpsLeading, [])).toEqual(["TANK", "HEALER", "DPS"]);
  });

  it("drops a role once the combo has taken all of it", () => {
    expect(rolesStillAvailable(tankLeading, [{ role: "HEALER" }])).toEqual(["DPS"]);
    expect(rolesStillAvailable(dpsLeading, [{ role: "DPS" }, { role: "DPS" }])).toEqual(["TANK", "HEALER"]);
  });

  it("is empty once the combo fills every budgeted spot", () => {
    const taken = [{ role: "HEALER" }, { role: "DPS" }, { role: "DPS" }, { role: "DPS" }];
    expect(rolesStillAvailable(tankLeading, taken)).toEqual([]);
  });

  it("ignores members whose role was never budgeted", () => {
    // An older saved combo can hold a tank the current owner role no longer
    // allows - it must not push the other roles negative.
    expect(rolesStillAvailable(tankLeading, [{ role: "TANK" }])).toEqual(["HEALER", "DPS"]);
  });
});
