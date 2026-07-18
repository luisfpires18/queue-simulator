import { NextResponse } from "next/server";
import { requireUser, loadOwnedCharacter, errorResponse } from "@/server/wclHelpers";
import { setCharacterRaidKills } from "@/data/source";
import { fetchLiveRaidKills } from "@/server/wcl/liveRaidKills";

export const dynamic = "force-dynamic";

// No parse/percentile is stored - kill/no-kill + difficulty only. The actual
// WCL lookup lives in fetchLiveRaidKills (shared with the live player-search
// fallback) - this route's only job is auth + persisting the result.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    const character = await loadOwnedCharacter(userId, id);

    const kills = await fetchLiveRaidKills({
      name: character.name,
      realmSlug: character.realmSlug,
      region: character.region,
    });

    await setCharacterRaidKills(id, kills);
    return NextResponse.json({ ok: true, kills });
  } catch (err) {
    return errorResponse(err);
  }
}
