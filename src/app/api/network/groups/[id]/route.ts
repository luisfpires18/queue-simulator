import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteChatGroup, getChatGroup, renameChatGroup } from "@/data/chatGroups";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const renameSchema = z.object({ name: z.string().min(1).max(60) });

function actionError(reason: "not_owner" | "not_friends" | "not_found") {
  if (reason === "not_owner") return NextResponse.json({ error: "Only the group owner can do that" }, { status: 403 });
  if (reason === "not_friends") return NextResponse.json({ error: "You're not friends with that player" }, { status: 409 });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const group = await getChatGroup(id, ctx.user.id);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ group });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, renameSchema);
  if (!body.ok) return body.response;

  const result = await renameChatGroup(id, ctx.user.id, body.data.name);
  if (!result.ok) return actionError(result.reason);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const result = await deleteChatGroup(id, ctx.user.id);
  if (!result.ok) return actionError(result.reason);
  return NextResponse.json({ ok: true });
}
