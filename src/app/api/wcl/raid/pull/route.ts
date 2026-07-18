import { NextResponse } from "next/server";
import { buildRaidPull, DEFAULT_RAID_DIFFICULTY } from "@/server/wcl/raid.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// One raid pull, charted vs the top parser's kill: DPS-over-time + rotation
// timeline + cast order, normalised by boss health. Heavy, so it's lazy/separate
// from /api/wcl/raid/report, mirroring /api/wcl/dps-series for M+.
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");
    const specId = searchParams.get("specId");
    const code = (searchParams.get("code") || "").trim();
    const encounterID = Number(searchParams.get("encounter"));
    const fightID = Number(searchParams.get("fight"));
    if (!characterId) throw new ApiError("characterId query param required", 400);
    if (!specId) throw new ApiError("specId query param required", 400);
    if (!code || !encounterID || !fightID) {
      throw new ApiError("code, encounter and fight query params are required", 400);
    }

    const character = await loadOwnedCharacter(userId, characterId);
    const { className, specName } = wclSpecParams(character.classId, specId);
    const difficulty = searchParams.get("difficulty") ? Number(searchParams.get("difficulty")) : DEFAULT_RAID_DIFFICULTY;

    const pull = await buildRaidPull({
      name: character.name,
      serverSlug: character.realmSlug,
      serverRegion: character.region.toUpperCase(),
      className,
      specName: specName!,
      code,
      encounterID,
      fightID,
      difficulty,
      compareTo: searchParams.get("compareTo") || null,
      refresh: wantsRefresh(searchParams),
    } as any);
    return NextResponse.json(pull);
  } catch (err) {
    return errorResponse(err);
  }
}
