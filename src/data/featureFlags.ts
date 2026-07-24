// Admin feature-flag reads/writes. Mirrors src/data/network.ts's shape: a
// pure merge/decision function kept separate from the DB call so it's
// unit-testable (see src/data/featureFlags.test.ts), plus thin Prisma
// wrappers around it.
import { prisma } from "@/lib/prisma";
import { FEATURE_FLAGS } from "@/game/featureFlags";
import type { FeatureFlagStateDTO } from "./dto";

/** Registry × DB rows: a flag with no row is enabled (the pre-flag default
 * behavior, see FeatureFlag's schema comment). Pure so it can be tested
 * without a database. */
export function mergeFlagState(rows: { id: string; enabled: boolean }[]): FeatureFlagStateDTO[] {
  const enabledByKey = new Map(rows.map((r) => [r.id, r.enabled]));
  return FEATURE_FLAGS.map((f) => ({
    key: f.key,
    label: f.label,
    description: f.description,
    enabled: enabledByKey.get(f.key) ?? true,
  }));
}

export async function listFeatureFlags(): Promise<FeatureFlagStateDTO[]> {
  const rows = await prisma.featureFlag.findMany();
  return mergeFlagState(rows);
}

/** Single-flag lookup for gate points (e.g. the Solo Queue join route) —
 * defaults to enabled when no row exists, same as listFeatureFlags(). */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { id: key } });
  return row?.enabled ?? true;
}

export async function setFeatureFlag(key: string, enabled: boolean): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { id: key },
    create: { id: key, enabled },
    update: { enabled },
  });
}
