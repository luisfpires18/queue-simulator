// Feature flag persistence.
//
// Rows are created lazily: a feature with no row is simply at its registry
// default (see resolveVisibility), so a fresh database needs no seeding and an
// unfinished area stays closed until someone deliberately opens it.
import { prisma } from "@/lib/prisma";
import {
  FEATURES,
  resolveVisibility,
  type FeatureDef,
  type Visibility,
} from "@/game/features";

export interface FeatureState {
  feature: FeatureDef;
  visibility: Visibility;
  /** True when no row exists and the registry default is being applied - the
   * dashboard says so rather than implying someone chose it. */
  usingDefault: boolean;
  note: string | null;
  grantCount: number;
  updatedAt: string | null;
}

export async function getVisibility(key: string): Promise<Visibility> {
  const row = await prisma.featureFlag.findUnique({
    where: { id: key },
    select: { visibility: true },
  });
  return resolveVisibility(key, row?.visibility);
}

/** Every registry feature with its current state, for the dashboard. Driven by
 * the registry rather than by the table, so a feature that has never been
 * touched still shows up. */
export async function listFeatureStates(): Promise<FeatureState[]> {
  const rows = await prisma.featureFlag.findMany({
    include: { _count: { select: { grants: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return FEATURES.map((feature) => {
    const row = byId.get(feature.key);
    return {
      feature,
      visibility: resolveVisibility(feature.key, row?.visibility),
      usingDefault: !row,
      note: row?.note ?? null,
      grantCount: row?._count.grants ?? 0,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function setVisibility(key: string, visibility: Visibility, note?: string | null) {
  return prisma.featureFlag.upsert({
    where: { id: key },
    create: { id: key, visibility, note: note ?? null },
    update: { visibility, ...(note === undefined ? {} : { note }) },
  });
}

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

/** Grants are keyed by bnetId, so this works for someone who has never signed
 * in. The flag row is created if needed - you can invite someone before you
 * have decided the visibility. */
export async function grantAccess(key: string, bnetId: string, note?: string | null) {
  await prisma.featureFlag.upsert({
    where: { id: key },
    create: { id: key, visibility: resolveVisibility(key, null) },
    update: {},
  });
  return prisma.featureAccess.upsert({
    where: { featureId_bnetId: { featureId: key, bnetId } },
    create: { featureId: key, bnetId, note: note ?? null },
    update: { note: note ?? null },
  });
}

export async function revokeAccess(key: string, bnetId: string): Promise<void> {
  await prisma.featureAccess.deleteMany({ where: { featureId: key, bnetId } });
}

export async function hasGrant(key: string, bnetId: string): Promise<boolean> {
  const row = await prisma.featureAccess.findUnique({
    where: { featureId_bnetId: { featureId: key, bnetId } },
    select: { id: true },
  });
  return !!row;
}

export interface GrantRow {
  bnetId: string;
  note: string | null;
  createdAt: string;
  /** Battletag when this bnetId has actually signed in, null when the invite
   * has not been taken up yet. */
  battletag: string | null;
}

/** Grants for one feature, joined to any User row that exists so the dashboard
 * can show a battletag instead of a bare id. */
export async function listGrants(key: string): Promise<GrantRow[]> {
  const grants = await prisma.featureAccess.findMany({
    where: { featureId: key },
    orderBy: { createdAt: "desc" },
  });
  if (!grants.length) return [];

  const users = await prisma.user.findMany({
    where: { bnetId: { in: grants.map((g) => g.bnetId) } },
    select: { bnetId: true, battletag: true },
  });
  const tagByBnetId = new Map(users.map((u) => [u.bnetId, u.battletag]));

  return grants.map((g) => ({
    bnetId: g.bnetId,
    note: g.note,
    createdAt: g.createdAt.toISOString(),
    battletag: tagByBnetId.get(g.bnetId) ?? null,
  }));
}

/** Every feature a given account has been granted, for the Users tab. */
export async function grantsForBnetId(bnetId: string): Promise<string[]> {
  const rows = await prisma.featureAccess.findMany({
    where: { bnetId },
    select: { featureId: true },
  });
  return rows.map((r) => r.featureId);
}
