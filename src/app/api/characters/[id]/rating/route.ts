import { NextResponse } from "next/server";
import { fetchRaiderIoRating } from "@/data/raiderio";
import { setCharacterRating } from "@/data/characters";
import { specById } from "@/game/classes";
import { getSessionUser, notAuthenticated, findOwnedCharacter } from "@/server/http";

export const dynamic = "force-dynamic";

// Pull this character's real M+ rating + per-spec breakdown from raider.io
// (public API, no Blizzard token needed) and store it. Raider.io instead of
// Blizzard's own profile API because Blizzard only ever exposes one best run
// per dungeon overall — a secondary spec's real runs never surface if they
// weren't the character's single best, badly under-counting anything but
// the main spec. See src/data/raiderio.ts.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const character = await findOwnedCharacter(ctx.user.id, id);
  if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await fetchRaiderIoRating(character.region, character.realmSlug, character.name);
  const specScores: { specId: string; score: number; role: string }[] = [];
  for (const sc of result.specScores) {
    const role = specById(sc.specId)?.role;
    if (role) specScores.push({ ...sc, role });
  }

  await setCharacterRating(id, result.overallRating, specScores, result.bestRunsBySpec, result.ilvl);
  return NextResponse.json({ ok: true, overallRating: result.overallRating, ilvl: result.ilvl, specScores, bestRunsBySpec: result.bestRunsBySpec });
}
