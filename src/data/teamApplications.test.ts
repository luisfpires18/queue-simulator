import { describe, it, expect } from "vitest";
import { trimSlotForRole } from "./teamApplications";
import type { OpenSlot } from "./dto";

const slot = (role: string, prefs: string[] = []): OpenSlot => ({ role, prefs });

describe("trimSlotForRole", () => {
  it("removes exactly one slot of the accepted role", () => {
    const slots = [slot("DPS", ["mage:fire"]), slot("DPS"), slot("HEALER")];
    expect(trimSlotForRole(slots, "DPS")).toEqual([slot("DPS"), slot("HEALER")]);
  });

  it("removes the first match, keeping later ones of the same role intact", () => {
    const slots = [slot("DPS", ["mage:fire"]), slot("DPS", ["rogue:outlaw"])];
    expect(trimSlotForRole(slots, "DPS")).toEqual([slot("DPS", ["rogue:outlaw"])]);
  });

  it("leaves the list untouched when no slot matches", () => {
    const slots = [slot("TANK"), slot("HEALER")];
    expect(trimSlotForRole(slots, "DPS")).toEqual(slots);
  });

  it("handles an empty slot list", () => {
    expect(trimSlotForRole([], "TANK")).toEqual([]);
  });

  it("never mutates the input", () => {
    const slots = [slot("TANK"), slot("DPS")];
    trimSlotForRole(slots, "TANK");
    expect(slots).toHaveLength(2);
  });
});
