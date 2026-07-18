import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureUser, getUserCharacters, setCurrentSelection } from "@/data/source";
import { specById } from "@/game/classes";

export const dynamic = "force-dynamic";

const schema = z.object({ characterId: z.string(), specId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = await getUserCharacters(user.id);
  const target = chars.find((c) => c.id === parsed.data.characterId && c.bucket !== "hidden");
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const spec = specById(parsed.data.specId);
  if (!spec || spec.classId !== target.classId) {
    return NextResponse.json({ error: "Spec doesn't match this character's class" }, { status: 400 });
  }

  await setCurrentSelection(user.id, target.id, parsed.data.specId);
  return NextResponse.json({ ok: true });
}
