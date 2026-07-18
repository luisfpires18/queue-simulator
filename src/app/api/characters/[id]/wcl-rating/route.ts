import { NextResponse } from "next/server";
import { fetchOverview } from "@/server/wcl/api.js";
import { setSpecPoints } from "@/data/source";
import { CLASS_BY_ID, type ClassId } from "@/game/classes";
import { requireUser, loadOwnedCharacter, wclSpecParams, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

/**
 * Warcraft Logs dungeon-score per spec — public API, no per-user WCL login.
 * Unlike Blizzard's rating (one best run per dungeon, whichever spec scored
 * it), WCL tracks every logged spec separately, so this can show a score for
 * a spec Blizzard's own API has no data for.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    const character = await loadOwnedCharacter(userId, id);
    if (!character.wclZone) {
      throw new ApiError("Set a Warcraft Logs zone for this character first (Parse Improvement tab → Zone/spec settings).", 400);
    }

    const specs = CLASS_BY_ID[character.classId as ClassId]?.specs ?? [];
    const specScores: { specId: string; role: string; points: number }[] = [];

    for (const spec of specs) {
      const { specName } = wclSpecParams(character.classId, spec.id);
      try {
        const overview = await fetchOverview({
          name: character.name,
          serverSlug: character.realmSlug,
          serverRegion: character.region.toUpperCase(),
          zoneID: Number(character.wclZone),
          specName,
        } as any);
        const points = overview?.overall?.scorePoints;
        if (typeof points === "number") specScores.push({ specId: spec.id, role: spec.role, points });
      } catch {
        // No logged runs on this spec this zone — leave it out, not an error.
      }
    }

    if (specScores.length) await setSpecPoints(id, specScores);
    return NextResponse.json({ specScores });
  } catch (err) {
    return errorResponse(err);
  }
}
