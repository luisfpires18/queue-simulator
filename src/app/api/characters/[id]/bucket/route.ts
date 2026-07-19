import { NextResponse } from "next/server";
import { z } from "zod";
import { setCharacterBucket } from "@/data/characters";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({ bucket: z.enum(["main", "alt", "hidden"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, schema, "Bad request");
  if (!body.ok) return body.response;

  const owned = await findOwnedCharacter(ctx.user.id, id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await setCharacterBucket(ctx.user.id, id, body.data.bucket);
  return NextResponse.json({ ok: true });
}
