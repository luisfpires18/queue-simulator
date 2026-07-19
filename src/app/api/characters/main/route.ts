import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCharacterSummary } from "@/data/blizzard";
import { setMain, updateCharacterSummary } from "@/data/characters";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({ characterId: z.string() });

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, schema, "Bad request");
  if (!body.ok) return body.response;

  const target = await findOwnedCharacter(ctx.user.id, body.data.characterId);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await setMain(ctx.user.id, target.id);

  // Fetch active spec + ilvl for the new main (cheap, single call).
  if (ctx.session.accessToken && !target.specId) {
    const summary = await fetchCharacterSummary(ctx.session.accessToken, target.realmSlug, target.name);
    await updateCharacterSummary(target.id, summary);
  }
  return NextResponse.json({ ok: true });
}
