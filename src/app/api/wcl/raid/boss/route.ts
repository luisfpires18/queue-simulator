import { NextResponse } from "next/server";
import { buildRaidBossReport, DEFAULT_RAID_DIFFICULTY } from "@/server/wcl/raid.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Analyse a raid boss from the character's own best ranked kill — no log code needed.
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
    const { className, specName } = wclSpecParams(character.classId, specId);

    const report = await buildRaidBossReport({
      name: character.name,
      serverSlug: character.realmSlug,
      serverRegion: character.region.toUpperCase(),
      className,
      specName: specName!,
      encounterID,
      difficulty: searchParams.get("difficulty") ? Number(searchParams.get("difficulty")) : DEFAULT_RAID_DIFFICULTY,
      compareTo: searchParams.get("compareTo") || null,
      refresh: wantsRefresh(searchParams),
    } as any);
    return NextResponse.json(report);
  } catch (err) {
    return errorResponse(err);
  }
}
