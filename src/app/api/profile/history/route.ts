import { NextResponse } from "next/server";
import { getSeasonHistory, listSnapshottedSeasons } from "@/data/seasonHistory";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const seasons = await listSnapshottedSeasons(ctx.user.id);
  const requestedId = new URL(req.url).searchParams.get("season");

  // A requested season with no snapshot for this user (e.g. a placeholder
  // season nobody's been captured for yet) is an honest empty result, not a
  // reason to silently substitute a different season's data - only fall
  // back to "most recent snapshotted" when the caller didn't ask for a
  // specific one at all.
  if (requestedId) {
    const characters = (await getSeasonHistory(ctx.user.id, requestedId)) ?? [];
    return NextResponse.json({ seasons, selectedSeasonId: requestedId, characters });
  }

  if (seasons.length === 0) return NextResponse.json({ seasons, characters: [] });
  const season = seasons[seasons.length - 1];
  const characters = (await getSeasonHistory(ctx.user.id, season.id)) ?? [];
  return NextResponse.json({ seasons, selectedSeasonId: season.id, characters });
}
