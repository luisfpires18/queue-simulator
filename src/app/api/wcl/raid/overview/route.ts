import { NextResponse } from "next/server";
import { fetchRaidOverview } from "@/server/wcl/raidZones.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// All raids of the current expansion and how this character parsed in each —
// the raid view's default landing page, no report code needed.
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");
    if (!characterId) throw new ApiError("characterId query param required", 400);

    const character = await loadOwnedCharacter(userId, characterId);
    const specId = searchParams.get("specId");
    const { specName } = wclSpecParams(character.classId, specId);

    const zones = await fetchRaidOverview({
      name: character.name,
      serverSlug: character.realmSlug,
      serverRegion: character.region.toUpperCase(),
      specName,
      refresh: wantsRefresh(searchParams),
    } as any);
    return NextResponse.json({ zones });
  } catch (err) {
    return errorResponse(err);
  }
}
