import { NextResponse } from "next/server";
import { fetchDungeonZones } from "@/server/wcl/raidZones.js";
import { requireUser, wantsRefresh, errorResponse } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const zones = await fetchDungeonZones({ refresh: wantsRefresh(searchParams) });
    return NextResponse.json({ zones });
  } catch (err) {
    return errorResponse(err);
  }
}
