import { NextResponse } from "next/server";
import { buildComparison, DEFAULT_LEVEL } from "@/server/wcl/comparison.js";
import { fetchDamageSeries } from "@/server/wcl/api.js";
import { requireUser, loadOwnedCharacter, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// DPS-over-time series (mine vs the comparison run) for the report's line
// chart. Separate/lazy from /api/wcl/report because the damage-event fetch is
// heavy — the report renders first, the chart loads after.
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
    const other = bundle.other;

    // sequential — gql() has a shared rate-limiter that parallel calls would race
    const mineSeries = await fetchDamageSeries({
      code: bundle.mine.detail.code,
      fightID: bundle.mine.detail.fightID,
      playerName: bundle.params.name,
      server: bundle.params.serverSlug,
      className: bundle.params.className,
    });
    const otherSeries = await fetchDamageSeries({
      code: other.detail.code,
      fightID: other.detail.fightID,
      playerName: other.meta.name,
    });
    return NextResponse.json({ mine: mineSeries, other: otherSeries, otherLabel: other.meta.name });
  } catch (err) {
    return errorResponse(err);
  }
}
