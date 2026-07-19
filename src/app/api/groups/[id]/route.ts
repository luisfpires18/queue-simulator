import { NextResponse } from "next/server";
import { updateGroup, deleteGroup } from "@/data/groups";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { groupInputSchema } from "../schema";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, groupInputSchema);
  if (!body.ok) return body.response;

  const owned = await findOwnedCharacter(ctx.user.id, body.data.ownerCharacterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  const ok = await updateGroup(id, ctx.user.id, body.data);
  if (!ok) return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const ok = await deleteGroup(id, ctx.user.id);
  if (!ok) return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
