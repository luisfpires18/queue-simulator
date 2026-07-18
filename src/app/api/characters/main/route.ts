import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { fetchCharacterSummary } from "@/data/blizzard";
import { ensureUser, setMain, updateCharacterSummary, getUserCharacters } from "@/data/source";

export const dynamic = "force-dynamic";

const schema = z.object({ characterId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; accessToken?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = await getUserCharacters(user.id);
  const target = chars.find((c) => c.id === parsed.data.characterId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await setMain(user.id, target.id);

  // Fetch active spec + ilvl for the new main (cheap, single call).
  if (s.accessToken && !target.specId) {
    const summary = await fetchCharacterSummary(s.accessToken, target.realmSlug, target.name);
    await updateCharacterSummary(target.id, summary);
  }
  return NextResponse.json({ ok: true });
}
