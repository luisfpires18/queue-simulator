// Pure predicates behind the /teams filter sidebar - kept out of the
// component so they're unit-testable without React (same split as
// isExpired in src/data/groups.ts).
import type { OpenSlot } from "@/data/dto";
import { specById } from "./classes";

/** Top of the "max required rating" slider - treated as "any requirement". */
export const MAX_REQ_RATING_FILTER = 4000;

/** True when the team is recruiting at least one of the selected roles. An
 * empty selection means "no role filter" and matches everything. */
export function teamMatchesRoles(slots: OpenSlot[], roles: Set<string>): boolean {
  if (roles.size === 0) return true;
  return slots.some((s) => roles.has(s.role));
}

/**
 * True when some open slot would take one of the selected specs.
 *
 * A slot with empty `prefs` is unranked - the team named a role but no
 * preferred specs, so it accepts anyone of that role. Those slots therefore
 * match any selected spec whose own role matches; excluding them would hide
 * exactly the most open teams from a spec search.
 */
export function teamMatchesSpecs(slots: OpenSlot[], specIds: Set<string>): boolean {
  if (specIds.size === 0) return true;
  return slots.some((slot) =>
    slot.prefs.length > 0
      ? slot.prefs.some((p) => specIds.has(p))
      : [...specIds].some((id) => specById(id)?.role === slot.role)
  );
}

/** True when the team's hard rating bar is at or below `max`. A team with no
 * rating requirement has no bar to clear, so it always passes. */
export function teamMatchesMaxRating(
  team: { requirementType: string | null; reqRating: number | null },
  max: number
): boolean {
  if (max >= MAX_REQ_RATING_FILTER) return true;
  if (team.requirementType !== "rating" || team.reqRating == null) return true;
  return team.reqRating <= max;
}
