// Listing-display formatting shared by GroupCard and GroupDetailsModal -
// previously copy-pasted between the two to avoid a circular import.
import type { GroupDTO } from "@/data/dto";

/** Compact label for the optional applicant-requirement chip - advisory
 * only, see src/game/achievements.ts. */
export function requirementChipLabel(group: GroupDTO): string | null {
  switch (group.requirementType) {
    case "rating":
      return group.reqRating != null ? `${group.reqRating}+ rating` : null;
    case "resilient":
      return group.reqLevel != null ? `Resilient +${group.reqLevel}` : null;
    case "custom":
      return group.reqLevel != null && group.reqExtraCount != null && group.reqExtraLevel != null
        ? `Resilient +${group.reqLevel} · ${group.reqExtraCount}×${group.reqExtraLevel}`
        : null;
    default:
      return null;
  }
}

/** "Forming now" vs. scheduled-start copy, plus an `urgent` flag (starting
 * within the hour) for callers that want to make it stand out. */
export function startInfo(startsAt: string | null): { label: string; urgent: boolean } {
  if (!startsAt) return { label: "Forming now", urgent: true };
  const d = new Date(startsAt);
  const minutesAway = (d.getTime() - Date.now()) / 60000;
  const label = `Starts ${d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
  return { label, urgent: minutesAway <= 60 };
}

export type BoardSortMode = "newest" | "starting";

/** "Forming now" (null startsAt) sorts as if starting this instant - it's
 * the earliest a key could possibly start, so it belongs at the front of a
 * "starting soonest" sort, ahead of anything scheduled for later. */
function startingSortValue(startsAt: string | null): number {
  return startsAt ? new Date(startsAt).getTime() : Date.now();
}

function isExpired(startsAt: string | null, now: number): boolean {
  return startsAt != null && new Date(startsAt).getTime() <= now;
}

/** Board listing sort - "newest" (the server's own createdAt-desc order,
 * the long-standing default) or "starting" (soonest scheduled start first).
 * Expired listings (a past startsAt - see CountdownLight) are stale, not
 * "starting soon", so they're bucketed to the bottom regardless of how far
 * past their time is, below "Forming now" and every still-upcoming key.
 * Returns a new array; never mutates the input. */
export function sortGroups(groups: GroupDTO[], mode: BoardSortMode): GroupDTO[] {
  const sorted = [...groups];
  if (mode === "newest") {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    const now = Date.now();
    sorted.sort((a, b) => {
      const aExpired = isExpired(a.startsAt, now);
      const bExpired = isExpired(b.startsAt, now);
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return startingSortValue(a.startsAt) - startingSortValue(b.startsAt);
    });
  }
  return sorted;
}
