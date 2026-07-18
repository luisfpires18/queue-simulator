// Shared logic for picking a default spec off a character's tracked history —
// used anywhere a player builds a listing from their own roster (List a key, Apply).
import type { RosterCharacterDTO } from "@/data/source";
import { classById } from "./classes";

/** This character's best-known spec: highest rating we have on record, else
 * their Blizzard-synced active spec, else the class's first spec. */
export function bestSpecFor(c: RosterCharacterDTO): string {
  const ranked = [...c.specTracks].sort((a, b) => (b.bnetScore ?? b.points ?? -1) - (a.bnetScore ?? a.points ?? -1));
  const top = ranked.find((t) => (t.bnetScore ?? t.points) != null);
  if (top) return top.specId;
  if (c.specId) return c.specId;
  return classById(c.classId)?.specs[0]?.id ?? "";
}
