import { NextResponse } from "next/server";
import { removeFriend } from "@/data/network";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { userId } = await params;
  const ok = await removeFriend(ctx.user.id, userId);
  if (!ok) return NextResponse.json({ error: "Not friends" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
