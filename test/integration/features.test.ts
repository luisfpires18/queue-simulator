import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getVisibility,
  grantAccess,
  grantsForBnetId,
  hasGrant,
  listFeatureStates,
  listGrants,
  revokeAccess,
  setVisibility,
} from "@/data/features";
import { canAccessFeature } from "@/game/features";
import { makeUser } from "./fixtures";

describe("defaults with no row", () => {
  it("reports the registry default rather than nothing", async () => {
    // A fresh database must leave an unfinished feature closed, without any
    // seeding step.
    expect(await getVisibility("recruitment")).toBe("admin");
    expect(await getVisibility("guilds")).toBe("admin");
    expect(await getVisibility("analyses")).toBe("admin");
  });

  it("never resolves an unknown feature to public", async () => {
    expect(await getVisibility("not-a-feature")).toBe("admin");
  });

  it("lists every registry feature even before any row exists", async () => {
    const states = await listFeatureStates();
    expect(states.map((s) => s.feature.key).sort()).toEqual(["analyses", "guilds", "recruitment"]);
    for (const s of states) {
      expect(s.usingDefault).toBe(true);
      expect(s.grantCount).toBe(0);
    }
  });

  it("falls back to the default when the stored value is nonsense", async () => {
    // Simulates a value written straight into the DB, or one from a newer
    // schema this build does not know.
    await prisma.featureFlag.create({ data: { id: "recruitment", visibility: "everyone" } });
    expect(await getVisibility("recruitment")).toBe("admin");
  });
});

describe("setVisibility", () => {
  it("creates the row on first write and takes effect", async () => {
    await setVisibility("recruitment", "public");
    expect(await getVisibility("recruitment")).toBe("public");

    const state = (await listFeatureStates()).find((s) => s.feature.key === "recruitment")!;
    expect(state.usingDefault).toBe(false);
    expect(state.visibility).toBe("public");
  });

  it("updates an existing row rather than duplicating", async () => {
    await setVisibility("guilds", "public");
    await setVisibility("guilds", "allowlist");

    expect(await getVisibility("guilds")).toBe("allowlist");
    expect(await prisma.featureFlag.count({ where: { id: "guilds" } })).toBe(1);
  });

  it("keeps features independent", async () => {
    await setVisibility("recruitment", "public");
    expect(await getVisibility("guilds")).toBe("admin");
  });

  it("stores a note without clobbering it on a later visibility change", async () => {
    await setVisibility("analyses", "allowlist", "burning WCL budget");
    await setVisibility("analyses", "admin");

    const row = await prisma.featureFlag.findUnique({ where: { id: "analyses" } });
    expect(row?.note).toBe("burning WCL budget");
    expect(row?.visibility).toBe("admin");
  });
});

describe("grants", () => {
  it("grants and revokes by bnetId", async () => {
    await grantAccess("recruitment", "bnet-123", "a friend");
    expect(await hasGrant("recruitment", "bnet-123")).toBe(true);

    await revokeAccess("recruitment", "bnet-123");
    expect(await hasGrant("recruitment", "bnet-123")).toBe(false);
  });

  it("works for someone who has never signed in", async () => {
    // The whole reason grants are keyed by bnetId rather than userId: you can
    // invite a person before they have an account.
    expect(await prisma.user.count({ where: { bnetId: "never-seen" } })).toBe(0);

    await grantAccess("guilds", "never-seen");
    expect(await hasGrant("guilds", "never-seen")).toBe(true);

    const grants = await listGrants("guilds");
    expect(grants).toHaveLength(1);
    expect(grants[0].battletag).toBeNull(); // shown as "not signed in yet"
  });

  it("shows the battletag once that account exists", async () => {
    const user = await makeUser("invitee");
    await grantAccess("guilds", user.bnetId);

    const grants = await listGrants("guilds");
    expect(grants[0].battletag).toBe(user.battletag);
  });

  it("creates the flag row so an invite can precede choosing a visibility", async () => {
    await grantAccess("recruitment", "bnet-early");
    expect(await prisma.featureFlag.count({ where: { id: "recruitment" } })).toBe(1);
    // Still closed - inviting someone does not open the feature by itself.
    expect(await getVisibility("recruitment")).toBe("admin");
  });

  it("is idempotent, updating the note rather than duplicating", async () => {
    await grantAccess("recruitment", "bnet-123", "first");
    await grantAccess("recruitment", "bnet-123", "second");

    const grants = await listGrants("recruitment");
    expect(grants).toHaveLength(1);
    expect(grants[0].note).toBe("second");
  });

  it("keeps grants separate per feature", async () => {
    await grantAccess("recruitment", "bnet-123");
    expect(await hasGrant("guilds", "bnet-123")).toBe(false);
    expect(await grantsForBnetId("bnet-123")).toEqual(["recruitment"]);
  });

  it("counts grants on the feature state", async () => {
    await grantAccess("recruitment", "a");
    await grantAccess("recruitment", "b");

    const state = (await listFeatureStates()).find((s) => s.feature.key === "recruitment")!;
    expect(state.grantCount).toBe(2);
  });

  it("drops grants when the flag row is deleted", async () => {
    await grantAccess("recruitment", "bnet-123");
    await prisma.featureFlag.delete({ where: { id: "recruitment" } });
    expect(await prisma.featureAccess.count({ where: { featureId: "recruitment" } })).toBe(0);
  });
});

describe("the access decision end to end", () => {
  /** Mirrors what canViewFeature does, minus the session lookup. */
  async function canSee(key: string, bnetId: string, isAdmin: boolean) {
    const visibility = await getVisibility(key);
    const isGranted = visibility === "allowlist" ? await hasGrant(key, bnetId) : false;
    return canAccessFeature({ visibility, isAdmin, isGranted });
  }

  it("hides an admin-only feature from a stranger, shows it to an admin", async () => {
    expect(await canSee("recruitment", "stranger", false)).toBe(false);
    expect(await canSee("recruitment", "owner", true)).toBe(true);
  });

  it("ignores a grant while the feature is admin only", async () => {
    await grantAccess("recruitment", "friend");
    expect(await canSee("recruitment", "friend", false)).toBe(false);
  });

  it("honours the grant once the feature moves to allowlist", async () => {
    await grantAccess("recruitment", "friend");
    await setVisibility("recruitment", "allowlist");

    expect(await canSee("recruitment", "friend", false)).toBe(true);
    expect(await canSee("recruitment", "stranger", false)).toBe(false);
  });

  it("closes again when the grant is revoked", async () => {
    await grantAccess("recruitment", "friend");
    await setVisibility("recruitment", "allowlist");
    await revokeAccess("recruitment", "friend");

    expect(await canSee("recruitment", "friend", false)).toBe(false);
  });

  it("opens to everyone at public, grant or not", async () => {
    await setVisibility("recruitment", "public");
    expect(await canSee("recruitment", "stranger", false)).toBe(true);
  });

  it("lets an admin through at every visibility", async () => {
    for (const v of ["admin", "allowlist", "public"] as const) {
      await setVisibility("guilds", v);
      expect(await canSee("guilds", "owner", true), v).toBe(true);
    }
  });
});
