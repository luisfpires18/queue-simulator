import { NextResponse } from "next/server";
import { fetchRaidZones } from "@/server/wcl/raidZones.js";
import { requireUser, wantsRefresh, errorResponse } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Flat boss list for the no-log "learn a boss" picker — unlike raid/overview,
// this needs no tracked character at all (rotations aren't about you).
export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const zones = await fetchRaidZones({ refresh: wantsRefresh(searchParams) });
    const bosses = zones.flatMap((z: any) =>
      z.encounters.map((e: any) => ({ encounterID: e.id, name: e.name, zoneName: z.name }))
    );
    return NextResponse.json({ bosses });
  } catch (err) {
    return errorResponse(err);
  }
}
