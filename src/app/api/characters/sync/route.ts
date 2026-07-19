import { NextResponse } from "next/server";
import { fetchAccountCharacters } from "@/data/blizzard";
import { ensureUser } from "@/data/users";
import { upsertCharacters } from "@/data/characters";
import { getBnetSession, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const s = await getBnetSession();
  if (!s?.accessToken) return notAuthenticated();
  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = await fetchAccountCharacters(s.accessToken);
  const count = await upsertCharacters(user.id, chars);
  return NextResponse.json({ imported: count });
}
