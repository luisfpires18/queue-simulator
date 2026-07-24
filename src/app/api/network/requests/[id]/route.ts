import { NextResponse } from "next/server";
import { cancelFriendRequest } from "@/data/network";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

// Cancels the caller's own still-pending outgoing request.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const ok = await cancelFriendRequest(id, ctx.user.id);
  if (!ok) return NextResponse.json({ error: "Not found, not yours, or already resolved" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
