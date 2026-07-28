import { describe, it, expect } from "vitest";
import { needsBattletagWrite } from "./users";

// ensureUser runs on every authenticated request, and a write takes SQLite's
// database-level lock - so "should we write at all" is the hot decision here.
describe("needsBattletagWrite", () => {
  it("skips the write when the stored battletag already matches", () => {
    expect(needsBattletagWrite("Hero#1234", "Hero#1234")).toBe(false);
  });

  it("writes when the battletag actually changed", () => {
    expect(needsBattletagWrite("Hero#1234", "Hero#5678")).toBe(true);
  });

  it("writes when nothing was stored yet", () => {
    expect(needsBattletagWrite(null, "Hero#1234")).toBe(true);
  });

  it("never wipes a stored battletag with an absent one", () => {
    // A session can carry no battletag; that is not a request to clear it.
    expect(needsBattletagWrite("Hero#1234", undefined)).toBe(false);
    expect(needsBattletagWrite(null, undefined)).toBe(false);
  });
});
