// Domain checks shared by more than one route/data-layer call site. Each
// returns data, not a Response — callers keep composing their own error
// messages and status codes.
import { specById } from "@/game/classes";
import { rankScoreFor, type ScoredSpecTrack } from "@/game/rating";

/** The spec, if it exists and belongs to this class; null otherwise. */
export function specMatchingClass(classId: string, specId: string) {
  const spec = specById(specId);
  return spec && spec.classId === classId ? spec : null;
}

/** The hard minimum-rating gate on a "rating"-requirement listing, applied
 * both at apply time (POST /api/groups/[id]/apply) and re-checked
 * authoritatively at accept time (acceptApplication) in case the owner
 * raised the requirement in between. Returns null when the group has no
 * such requirement or the score clears it; otherwise the failing numbers. */
export function minRatingFailure(
  group: { requirementType: string | null; reqRating: number | null },
  specTracks: ScoredSpecTrack[],
  appliedSpecId: string
): { score: number; required: number } | null {
  if (group.requirementType !== "rating" || group.reqRating == null) return null;
  const { score } = rankScoreFor(specTracks, appliedSpecId);
  return score < group.reqRating ? { score, required: group.reqRating } : null;
}
