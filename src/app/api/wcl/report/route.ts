import { NextResponse } from "next/server";
import { buildComparison, DEFAULT_LEVEL } from "@/server/wcl/comparison.js";
import { buildReport } from "@/server/analysis/compare.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// The gap report for one dungeon at one key level: my best run vs a comparable
// top-same-spec run, ranked "biggest gaps first" with advice.
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");
    const specId = searchParams.get("specId");
    const encounterID = Number(searchParams.get("encounter"));
    if (!characterId) throw new ApiError("characterId query param required", 400);
    if (!specId) throw new ApiError("specId query param required", 400);
    if (!encounterID) throw new ApiError("encounter query param required", 400);

    const character = await loadOwnedCharacter(userId, characterId);
    if (!character.wclZone) throw new ApiError("This character has no Warcraft Logs zone configured yet", 400);
    const { className, specName } = wclSpecParams(character.classId, specId);

    const level = Math.max(2, Math.min(30, Number(searchParams.get("level")) || DEFAULT_LEVEL));
    const compareTo = searchParams.get("compareTo") || null;

    const bundle = await buildComparison({
      name: character.name,
      serverSlug: character.realmSlug,
      serverRegion: character.region.toUpperCase(),
      zoneID: Number(character.wclZone),
      encounterID,
      className,
      specName: specName!,
      level,
      compareTo,
      refresh: wantsRefresh(searchParams),
    } as any);
    return NextResponse.json(buildReport(bundle));
  } catch (err) {
    return errorResponse(err);
  }
}
