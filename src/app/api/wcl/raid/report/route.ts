import { NextResponse } from "next/server";
import { buildRaidReport, DEFAULT_RAID_DIFFICULTY } from "@/server/wcl/raid.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Raid progression from a pasted report code — kills OR wipes. With no
// `encounter` param it returns just the boss menu (cheap); with one, it fetches
// every pull's casts plus the ranked-kill benchmark (heavier).
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    const { searchParams } = new URL(req.url);
    const characterId = searchParams.get("characterId");
    const specId = searchParams.get("specId");
    const code = (searchParams.get("code") || "").trim();
    if (!characterId) throw new ApiError("characterId query param required", 400);
    if (!specId) throw new ApiError("specId query param required", 400);
    if (!code) throw new ApiError("code query param required (report code or URL)", 400);

    const character = await loadOwnedCharacter(userId, characterId);
    const { className, specName } = wclSpecParams(character.classId, specId);

    const encounterID = searchParams.get("encounter") ? Number(searchParams.get("encounter")) : null;
    const difficulty = searchParams.get("difficulty") ? Number(searchParams.get("difficulty")) : DEFAULT_RAID_DIFFICULTY;
    const maxAttempts = Math.max(2, Math.min(40, Number(searchParams.get("maxAttempts")) || 24));

    const report = await buildRaidReport({
      name: character.name,
      serverSlug: character.realmSlug,
      serverRegion: character.region.toUpperCase(),
      className,
      specName: specName!,
      code,
      encounterID,
      difficulty,
      maxAttempts,
      benchmark: searchParams.get("benchmark") !== "0",
      refresh: wantsRefresh(searchParams),
    } as any);
    return NextResponse.json(report);
  } catch (err) {
    return errorResponse(err);
  }
}
