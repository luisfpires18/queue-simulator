// Universal player lookup - synthesizes a RosterCharacterDTO-shaped object for
// ANY character (region/realmSlug/name), whether or not they've ever synced
// into this app, straight from raider.io's public API (no auth, no local DB
// row needed - see src/data/raiderio.ts). Used as the fallback path by
// /player/[region]/[realmSlug]/[name] when the character isn't a registered
// account here (see getPublicCharacters in src/data/source.ts for the
// DB-first path that's tried before this one).
import { fetchRaiderIoRating } from "./raiderio";
import { specById } from "@/game/classes";
import { fetchLiveRaidKills } from "@/server/wcl/liveRaidKills";
import type { RosterCharacterDTO, SpecTrackDTO } from "./dto";

/** Null when raider.io has no record at all for this character (never
 * logged a Mythic+ run, or the name/realm/region combo doesn't exist) - a
 * normal "not found" outcome for a live search, not an error. */
export async function fetchLivePlayerProfile(
  region: string,
  realmSlug: string,
  name: string
): Promise<RosterCharacterDTO | null> {
  const result = await fetchRaiderIoRating(region, realmSlug, name);
  if (result.classId == null && result.overallRating == null && result.specScores.length === 0) {
    return null;
  }

  const id = `live:${region}:${realmSlug}:${name.toLowerCase()}`;
  const specTracks: SpecTrackDTO[] = result.specScores.map((s) => ({
    id: `${id}:${s.specId}`,
    characterId: id,
    specId: s.specId,
    role: specById(s.specId)?.role ?? "DPS",
    points: null,
    bnetScore: s.score,
    isMain: s.specId === result.activeSpecId,
    bestRuns: result.bestRunsBySpec[s.specId] ?? [],
  }));

  // Best-effort - a WCL hiccup or a character with no logs at all shouldn't
  // fail the whole live snapshot, it should just show an empty raid section.
  const raidKills = await fetchLiveRaidKills({ name, realmSlug, region }).catch(() => []);

  return {
    id,
    name,
    realm: result.realmName ?? realmSlug,
    realmSlug,
    region,
    classId: result.classId ?? "warrior", // display fallback only - a real classId should always resolve when specScores exist
    specId: result.activeSpecId,
    level: 80,
    ilvl: result.ilvl,
    rating: result.overallRating,
    faction: result.faction ?? "Alliance",
    isMain: true,
    bucket: "main",
    sortOrder: 0,
    wclZone: null,
    raidKills,
    specTracks,
  };
}
