import { describe, it, expect } from "vitest";
import {
  FEATURES,
  FEATURE_BY_KEY,
  canAccessFeature,
  grantsApply,
  isFeatureKey,
  isVisibility,
  resolveVisibility,
  VISIBILITY_LABEL,
  type Visibility,
} from "./features";

describe("registry", () => {
  it("gates every currently-registered feature to admin by default", () => {
    // The whole point of the gate: a fresh database leaves the unfinished
    // areas closed.
    for (const f of FEATURES) {
      expect(f.defaultVisibility, f.key).toBe("admin");
    }
  });

  it("labels every visibility", () => {
    for (const v of ["admin", "allowlist", "public"] as Visibility[]) {
      expect(VISIBILITY_LABEL[v]).toBeTruthy();
    }
  });

  it("recognises its own keys and nothing else", () => {
    expect(isFeatureKey("recruitment")).toBe(true);
    expect(isFeatureKey("guilds")).toBe(true);
    expect(isFeatureKey("analyses")).toBe(true);
    expect(isFeatureKey("runs")).toBe(false);
    expect(isFeatureKey("")).toBe(false);
  });

  it("indexes each feature by key", () => {
    for (const f of FEATURES) expect(FEATURE_BY_KEY[f.key]).toBe(f);
  });
});

describe("isVisibility", () => {
  it("accepts the three real values", () => {
    expect(isVisibility("admin")).toBe(true);
    expect(isVisibility("allowlist")).toBe(true);
    expect(isVisibility("public")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isVisibility("everyone")).toBe(false);
    expect(isVisibility("")).toBe(false);
    expect(isVisibility("PUBLIC")).toBe(false);
  });
});

describe("resolveVisibility - fails closed", () => {
  it("uses the stored value when it is valid", () => {
    expect(resolveVisibility("recruitment", "public")).toBe("public");
    expect(resolveVisibility("recruitment", "allowlist")).toBe("allowlist");
  });

  it("falls back to the default when there is no row", () => {
    expect(resolveVisibility("recruitment", null)).toBe("admin");
    expect(resolveVisibility("recruitment", undefined)).toBe("admin");
  });

  it("falls back to the default on a value it does not recognise", () => {
    // A typo written straight into the database, or a value from a newer
    // schema, must not publish an alpha.
    expect(resolveVisibility("recruitment", "everyone")).toBe("admin");
    expect(resolveVisibility("recruitment", "")).toBe("admin");
  });

  it("never resolves an unknown feature to public", () => {
    expect(resolveVisibility("not-a-feature", null)).toBe("admin");
    expect(resolveVisibility("not-a-feature", "nonsense")).toBe("admin");
  });
});

describe("canAccessFeature", () => {
  const check = (visibility: Visibility, isAdmin: boolean, isGranted: boolean) =>
    canAccessFeature({ visibility, isAdmin, isGranted });

  it("lets an admin through at every visibility", () => {
    // They set the flag; locking them out of their own alpha would be absurd.
    for (const v of ["admin", "allowlist", "public"] as Visibility[]) {
      expect(check(v, true, false), v).toBe(true);
      expect(check(v, true, true), v).toBe(true);
    }
  });

  it("admin-only refuses everyone else, granted or not", () => {
    expect(check("admin", false, false)).toBe(false);
    // A grant does not override admin-only - that is what grantsApply says.
    expect(check("admin", false, true)).toBe(false);
  });

  it("allowlist admits the granted and refuses strangers", () => {
    expect(check("allowlist", false, true)).toBe(true);
    expect(check("allowlist", false, false)).toBe(false);
  });

  it("public admits everyone, grant or no grant", () => {
    expect(check("public", false, false)).toBe(true);
    expect(check("public", false, true)).toBe(true);
  });

  it("covers the full matrix with no surprises", () => {
    const expected: Record<Visibility, [boolean, boolean]> = {
      // [stranger, granted] - admins are always true, asserted above
      admin: [false, false],
      allowlist: [false, true],
      public: [true, true],
    };
    for (const [visibility, [stranger, granted]] of Object.entries(expected)) {
      expect(check(visibility as Visibility, false, false), `${visibility}/stranger`).toBe(stranger);
      expect(check(visibility as Visibility, false, true), `${visibility}/granted`).toBe(granted);
    }
  });
});

describe("grantsApply", () => {
  it("is true only for allowlist", () => {
    expect(grantsApply("allowlist")).toBe(true);
    expect(grantsApply("admin")).toBe(false);
    expect(grantsApply("public")).toBe(false);
  });
});
