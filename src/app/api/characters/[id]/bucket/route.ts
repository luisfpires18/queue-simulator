import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureUser, setCharacterBucket, getUserCharacters } from "@/data/source";

export const dynamic = "force-dynamic";

const schema = z.object({ bucket: z.enum(["main", "alt", "hidden"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = await getUserCharacters(user.id);
  if (!chars.some((c) => c.id === id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await setCharacterBucket(user.id, id, parsed.data.bucket);
  return NextResponse.json({ ok: true });
}
