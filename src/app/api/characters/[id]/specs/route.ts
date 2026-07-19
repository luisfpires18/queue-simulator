import { NextResponse } from "next/server";
import { z } from "zod";
import { setMainSpec } from "@/data/characters";
import { specMatchingClass } from "@/server/guards";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({ specId: z.string() });

// Mark one spec as this character's curated main, for the Characters-tab
// star. Distinct from PUT /api/wcl/characters/[id]/specs, which replaces the
// whole tracked set for Parse Improvement's zone/spec settings.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, schema, "Bad request");
  if (!body.ok) return body.response;

  const character = await findOwnedCharacter(ctx.user.id, id);
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const spec = specMatchingClass(character.classId, body.data.specId);
  if (!spec) {
    return NextResponse.json({ error: "Spec doesn't match this character's class" }, { status: 400 });
  }

  const tracks = await setMainSpec(id, body.data.specId, spec.role);
  return NextResponse.json(tracks);
}
