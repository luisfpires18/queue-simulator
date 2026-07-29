import { NextResponse } from "next/server";
import { z } from "zod";
import { setCharacterWclZone } from "@/data/characters";
import { requireUser, loadOwnedCharacter, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// A WCL zone id is always a small positive integer (see the dungeon-zones
// list this is picked from) - empty string is the "no zone selected"
// placeholder option's value (CharacterSettings.tsx), treated the same as
// null. Anything else is bounded instead of storing whatever string a raw
// request sends.
const patchSchema = z.object({
  wclZone: z.union([z.literal(""), z.string().regex(/^\d{1,10}$/)]).nullable(),
});

// Set which Warcraft Logs zone this character is tracked against for parse
// analysis. Roster bucket/order live under /api/characters/[id] instead —
// that's general character management, not parse-analysis specific.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    await loadOwnedCharacter(userId, id);

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("Invalid zone", 400);

    await setCharacterWclZone(id, parsed.data.wclZone || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
