// Shared main-vs-applied-spec rating logic — used both client-side
// (RatingDetails.tsx, showing the Main/Off score split) and server-side
// (source.ts, ranking Pending Requests by rating). Generic over the track
// shape rather than importing SpecTrackDTO from the data layer, same
// approach as bestOverallRun in season.ts.
export interface ScoredSpecTrack {
  specId: string;
  isMain: boolean;
  bnetScore: number | null;
  points: number | null;
}

export function trackScore(t: ScoredSpecTrack | null | undefined): number | null {
  return t?.bnetScore ?? t?.points ?? null;
}

/** The character's curated main spec, falling back to whichever tracked spec
 * scores highest when none is explicitly flagged. Null if there are no
 * tracked specs at all. */
export function pickMainTrack<T extends ScoredSpecTrack>(tracks: T[]): T | null {
  return (
    tracks.find((t) => t.isMain)
    ?? [...tracks].sort((a, b) => (trackScore(b) ?? -1) - (trackScore(a) ?? -1))[0]
    ?? null
  );
}

/** Ranking key for "how good is this character, for the spec they're
 * bringing to this key" — normally just that spec's own score, but if their
 * curated main spec is a *different* spec and rates higher, that higher
 * score becomes the key (rankedByMain: true) so a strong player isn't
 * buried in the queue just because they applied on an alt spec. The caller
 * is expected to show a warning badge whenever rankedByMain is true, since
 * the number isn't a guarantee about the spec actually being brought. */
export function rankScoreFor<T extends ScoredSpecTrack>(
  tracks: T[],
  appliedSpecId: string
): { score: number; rankedByMain: boolean } {
  const applied = tracks.find((t) => t.specId === appliedSpecId) ?? null;
  const main = pickMainTrack(tracks);
  const appliedScore = trackScore(applied) ?? -1;
  const mainScore = trackScore(main) ?? -1;
  if (main && main.specId !== appliedSpecId && mainScore > appliedScore) {
    return { score: mainScore, rankedByMain: true };
  }
  return { score: appliedScore, rankedByMain: false };
}
