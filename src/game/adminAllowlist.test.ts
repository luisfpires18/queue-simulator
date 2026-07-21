import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { adminEnabled, isAdminBnetId } from "./adminAllowlist";

const ORIGINAL = process.env.ADMIN_BNET_IDS;

beforeEach(() => {
  delete process.env.ADMIN_BNET_IDS;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_BNET_IDS;
  else process.env.ADMIN_BNET_IDS = ORIGINAL;
});

describe("adminAllowlist", () => {
  it("makes nobody an admin when unset", () => {
    expect(adminEnabled()).toBe(false);
    expect(isAdminBnetId("anyone")).toBe(false);
  });

  it("makes nobody an admin when empty", () => {
    process.env.ADMIN_BNET_IDS = "";
    expect(adminEnabled()).toBe(false);
    expect(isAdminBnetId("anyone")).toBe(false);
  });

  it("treats a list of only separators as empty", () => {
    process.env.ADMIN_BNET_IDS = ",,  ,";
    expect(adminEnabled()).toBe(false);
    expect(isAdminBnetId("")).toBe(false);
  });

  it("admits exactly the listed ids", () => {
    process.env.ADMIN_BNET_IDS = "alice,bob";
    expect(isAdminBnetId("alice")).toBe(true);
    expect(isAdminBnetId("bob")).toBe(true);
    expect(isAdminBnetId("mallory")).toBe(false);
  });

  it("tolerates whitespace around entries", () => {
    process.env.ADMIN_BNET_IDS = " alice , bob ";
    expect(isAdminBnetId("alice")).toBe(true);
    expect(isAdminBnetId("bob")).toBe(true);
  });

  it("refuses a missing or empty id", () => {
    process.env.ADMIN_BNET_IDS = "alice";
    expect(isAdminBnetId("")).toBe(false);
    expect(isAdminBnetId(undefined)).toBe(false);
    expect(isAdminBnetId(null)).toBe(false);
  });

  it("does not match a prefix, suffix or substring of a real admin id", () => {
    // Set membership, not string containment. A substring check here would be
    // a privilege-escalation bug.
    process.env.ADMIN_BNET_IDS = "alice";
    expect(isAdminBnetId("alic")).toBe(false);
    expect(isAdminBnetId("alicee")).toBe(false);
    expect(isAdminBnetId("Alice")).toBe(false); // case-sensitive
  });

  it("re-reads the environment on each call", () => {
    // Not cached at module load, so a test (or a restart-free config change)
    // cannot leave a stale allowlist behind.
    expect(isAdminBnetId("alice")).toBe(false);
    process.env.ADMIN_BNET_IDS = "alice";
    expect(isAdminBnetId("alice")).toBe(true);
  });
});
