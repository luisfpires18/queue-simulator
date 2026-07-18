import { NextResponse } from "next/server";
import { buildBossRotations, DEFAULT_RAID_DIFFICULTY } from "@/server/wcl/raid.js";
import { requireUser, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// How one top-ranked player of a class+spec plays a boss — rotation only, plus
// the roster of others to switch to. Not tied to your own character or a log:
// this is the "learn the fight before you pull it" view, so classId/specId
// come straight from the query, not from a tracked character.
export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const specId = searchParams.get("specId");
    const encounterID = Number(searchParams.get("encounter"));
    if (!classId || !specId) throw new ApiError("classId and specId query params are required", 400);
    if (!encounterID) throw new ApiError("encounter query param required", 400);
    const { className, specName } = wclSpecParams(classId, specId);

    const rotations = await buildBossRotations({
      className,
      specName: specName!,
      encounterID,
      difficulty: searchParams.get("difficulty") ? Number(searchParams.get("difficulty")) : DEFAULT_RAID_DIFFICULTY,
      player: searchParams.get("player") || null,
      topN: Math.max(2, Math.min(25, Number(searchParams.get("top")) || 10)),
      refresh: wantsRefresh(searchParams),
    } as any);
    return NextResponse.json(rotations);
  } catch (err) {
    return errorResponse(err);
  }
}
