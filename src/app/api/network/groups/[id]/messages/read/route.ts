import { NextResponse } from "next/server";
import { markChatGroupRead } from "@/data/chatGroupMessages";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  await markChatGroupRead(id, ctx.user.id);
  return NextResponse.json({ ok: true });
}
