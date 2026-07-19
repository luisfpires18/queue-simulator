import { NextResponse } from "next/server";
import { getUserCharacters, getSpecTracks } from "@/data/characters";
import { requireUser, errorResponse } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Roster for the Parses picker. Characters themselves come from the Battle.net
// sync (POST /api/characters/sync) — this just adds each one's WCL zone +
// tracked-spec settings for parse analysis.
export async function GET() {
  try {
    const { userId } = await requireUser();
    const characters = await getUserCharacters(userId);
    const withTracks = await Promise.all(
      characters.map(async (c) => ({ ...c, specTracks: await getSpecTracks(c.id) }))
    );
    return NextResponse.json(withTracks);
  } catch (err) {
    return errorResponse(err);
  }
}
