import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureUser, getUserCharacters, setMainSpec } from "@/data/source";
import { specById } from "@/game/classes";

export const dynamic = "force-dynamic";

const schema = z.object({ specId: z.string() });

// Mark one spec as this character's curated main, for the Characters-tab
// star. Distinct from PUT /api/wcl/characters/[id]/specs, which replaces the
// whole tracked set for Parse Improvement's zone/spec settings.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = await getUserCharacters(user.id);
  const character = chars.find((c) => c.id === id);
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const spec = specById(parsed.data.specId);
  if (!spec || spec.classId !== character.classId) {
    return NextResponse.json({ error: "Spec doesn't match this character's class" }, { status: 400 });
  }

  const tracks = await setMainSpec(id, parsed.data.specId, spec.role);
  return NextResponse.json(tracks);
}
