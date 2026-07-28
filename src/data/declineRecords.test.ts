import { describe, it, expect } from "vitest";
import { declineRecordData } from "./declineRecords";

const base = {
  applicantUserId: "u1",
  declinedByUserId: "u2",
  listingKind: "mplus",
  listingTitle: "+10 Algeth'ar",
  listingId: "g1",
  reasonId: "r1",
  reasonLabel: "Comp already covered",
  characterName: "Testymage",
  characterRealm: "Khadgar",
  classId: "mage",
  role: "DPS",
  specId: "mage:frost",
};

describe("declineRecordData", () => {
  it("keeps a real note", () => {
    expect(declineRecordData({ ...base, note: "  need a lust class  " }).note).toBe("need a lust class");
  });

  it("stores nothing rather than an empty note", () => {
    // An empty string would render an empty quote block in the history UI.
    expect(declineRecordData({ ...base, note: "   " }).note).toBeNull();
    expect(declineRecordData({ ...base, note: "" }).note).toBeNull();
    expect(declineRecordData({ ...base, note: null }).note).toBeNull();
    expect(declineRecordData(base).note).toBeNull();
  });

  it("passes the frozen display fields through untouched", () => {
    const out = declineRecordData(base);
    expect(out.reasonLabel).toBe("Comp already covered");
    expect(out.listingTitle).toBe("+10 Algeth'ar");
    expect(out.characterName).toBe("Testymage");
  });
});
