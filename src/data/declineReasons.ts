// Admin-managed decline vocabulary. The first runtime-editable list in the
// app - FeatureFlag and AppSetting both keep their vocabulary in TypeScript,
// which can't work here because editing it at runtime is the whole point.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DeclineReasonDTO } from "./dto";

export const DECLINE_REASONS_TAG = "decline-reasons";

function toDTO(r: { id: string; label: string; sortOrder: number; active: boolean }): DeclineReasonDTO {
  return { id: r.id, label: r.label, sortOrder: r.sortOrder, active: r.active };
}

/** Active reasons only, in admin-defined order - what a decline picker shows.
 * Cached across requests/users (Next's unstable_cache, not React's
 * request-scoped cache) - every GroupCard/TeamCard that opens a
 * DeclineDialog hits this, and it's safe to share globally because the data
 * is admin-managed and carries nothing user-scoped. Invalidated via
 * revalidateTag(DECLINE_REASONS_TAG) from the admin create/update routes. */
export const listActiveDeclineReasons = unstable_cache(
  async (): Promise<DeclineReasonDTO[]> => {
    const rows = await prisma.declineReason.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return rows.map(toDTO);
  },
  ["decline-reasons-active"],
  { tags: [DECLINE_REASONS_TAG] }
);

/** Everything including archived - the admin panel's own list. */
export async function listAllDeclineReasons(): Promise<DeclineReasonDTO[]> {
  const rows = await prisma.declineReason.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(toDTO);
}

/** New reasons land at the end of the list. */
export async function createDeclineReason(label: string): Promise<DeclineReasonDTO> {
  const last = await prisma.declineReason.findFirst({ orderBy: { sortOrder: "desc" } });
  const row = await prisma.declineReason.create({
    data: { label: label.trim(), sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  return toDTO(row);
}

export async function updateDeclineReason(
  id: string,
  patch: { label?: string; sortOrder?: number; active?: boolean }
): Promise<DeclineReasonDTO | null> {
  const existing = await prisma.declineReason.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.declineReason.update({
    where: { id },
    data: {
      ...(patch.label != null ? { label: patch.label.trim() } : {}),
      ...(patch.sortOrder != null ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.active != null ? { active: patch.active } : {}),
    },
  });
  return toDTO(row);
}

/**
 * The reason to record for a decline, or null when the id names nothing
 * usable. Archived reasons are rejected: they're gone from every picker, so
 * an id referencing one arrived from a stale tab or a hand-made request.
 */
export async function resolveDeclineReason(id: string): Promise<{ id: string; label: string } | null> {
  const row = await prisma.declineReason.findUnique({ where: { id } });
  if (!row || !row.active) return null;
  return { id: row.id, label: row.label };
}
