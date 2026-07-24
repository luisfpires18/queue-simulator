import { NextResponse } from "next/server";
import { z } from "zod";
import { getBnetSession, parseBody } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { getCurrentSeasonId, setCurrentSeasonId } from "@/data/appSettings";
import { SEASONS } from "@/game/season";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  seasonId: z.enum(SEASONS.map((s) => s.id) as [string, ...string[]]),
});

export async function GET() {
  const session = await getBnetSession();
  // 404, not 401/403 - same as every other /api/admin/* route.
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentSeasonId = await getCurrentSeasonId();
  return NextResponse.json({ seasons: SEASONS, currentSeasonId });
}

export async function PATCH(req: Request) {
  const session = await getBnetSession();
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  await setCurrentSeasonId(body.data.seasonId);
  return NextResponse.json({ ok: true });
}
