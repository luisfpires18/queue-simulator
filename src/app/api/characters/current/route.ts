import { NextResponse } from "next/server";
import { z } from "zod";
import { setCurrentSelection } from "@/data/users";
import { specMatchingClass } from "@/server/guards";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({ characterId: z.string(), specId: z.string() });

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, schema, "Bad request");
  if (!body.ok) return body.response;

  const target = await findOwnedCharacter(ctx.user.id, body.data.characterId);
  // Hidden characters can't be the navbar's current selection.
  if (!target || target.bucket === "hidden") return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!specMatchingClass(target.classId, body.data.specId)) {
    return NextResponse.json({ error: "Spec doesn't match this character's class" }, { status: 400 });
  }

  await setCurrentSelection(ctx.user.id, target.id, body.data.specId);
  return NextResponse.json({ ok: true });
}
