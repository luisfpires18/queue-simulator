import { NextResponse } from "next/server";
import { leaveChatGroup, removeChatGroupMember } from "@/data/chatGroups";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

// Removing yourself is "leave" (anyone can); removing someone else is
// owner-only (see removeChatGroupMember).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id, userId } = await params;
  const result = userId === ctx.user.id ? await leaveChatGroup(id, ctx.user.id) : await removeChatGroupMember(id, ctx.user.id, userId);

  if (!result.ok) {
    if (result.reason === "not_owner") return NextResponse.json({ error: "Only the group owner can remove members" }, { status: 403 });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
