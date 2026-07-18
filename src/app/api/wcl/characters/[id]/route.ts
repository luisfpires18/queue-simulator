import { NextResponse } from "next/server";
import { setCharacterWclZone } from "@/data/source";
import { requireUser, loadOwnedCharacter, errorResponse } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Set which Warcraft Logs zone this character is tracked against for parse
// analysis. Roster bucket/order live under /api/characters/[id] instead —
// that's general character management, not parse-analysis specific.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    await loadOwnedCharacter(userId, id);

    const body = await req.json().catch(() => ({}));
    if (typeof body.wclZone === "string" || body.wclZone === null) {
      await setCharacterWclZone(id, body.wclZone);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
