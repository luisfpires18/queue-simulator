import { NextResponse } from "next/server";
import { setSpecTracks } from "@/data/characters";
import { specById } from "@/game/classes";
import { requireUser, loadOwnedCharacter, errorResponse, ApiError } from "@/server/wclHelpers";

export const dynamic = "force-dynamic";

// Replace which specs of this character are tracked for parse analysis. All
// roles are kept — a tank/healer spec still carries its M+ score — only DPS
// specs drive the damage-based gap report (filtered client-side).
//
// Takes no score from the client - see setSpecTracks's own comment. This
// route only ever curates WHICH specs are tracked; their cached Warcraft
// Logs points are set exclusively by POST .../wcl-rating (a real WCL fetch),
// never by this one.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser();
    const { id } = await params;
    const character = await loadOwnedCharacter(userId, id);

    const body = await req.json().catch(() => null);
    const wanted = Array.isArray(body?.specs) ? body.specs : [];
    if (!wanted.length) throw new ApiError("Pick at least one spec", 400);

    const specs = wanted.map((s: { specId?: unknown }) => {
      const specId = String(s?.specId ?? "");
      const spec = specById(specId);
      if (!spec || spec.classId !== character.classId) {
        throw new ApiError(`"${specId}" is not a spec of this character's class`, 400);
      }
      return { specId, role: spec.role };
    });

    const tracks = await setSpecTracks(id, specs);
    return NextResponse.json(tracks);
  } catch (err) {
    return errorResponse(err);
  }
}
