import { NextResponse } from "next/server";
import { fetchOverview } from "@/server/wcl/api.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Per-dungeon overview (score/DPS/percentiles) for one tracked character.
// ?characterId=... required, ?specId=... optional (omitted = all specs blended).
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");
    if (!characterId) throw new ApiError("characterId query param required", 400);

    const character = await loadOwnedCharacter(userId, characterId);
    if (!character.wclZone) throw new ApiError("This character has no Warcraft Logs zone configured yet", 400);

    const specId = searchParams.get("specId");
    const { specName } = wclSpecParams(character.classId, specId);

    const overview = await fetchOverview({
      name: character.name,
      serverSlug: character.realmSlug,
      serverRegion: character.region.toUpperCase(),
      zoneID: Number(character.wclZone),
      specName,
      refresh: wantsRefresh(searchParams),
    } as any);
    const { raw: _raw, ...rest } = overview;
    return NextResponse.json(rest);
  } catch (err) {
    return errorResponse(err);
  }
}
