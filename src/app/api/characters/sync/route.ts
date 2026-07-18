import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchAccountCharacters } from "@/data/blizzard";
import { ensureUser, upsertCharacters } from "@/data/source";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; accessToken?: string; battletag?: string }) | null;
  if (!s?.bnetId || !s.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = await fetchAccountCharacters(s.accessToken);
  const count = await upsertCharacters(user.id, chars);
  return NextResponse.json({ imported: count });
}
