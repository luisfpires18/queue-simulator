import { NextResponse } from "next/server";
import { removeTeamMember } from "@/data/teams";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

// Removing yourself is "leave" (any member can); removing someone else is
// owner-only. The owner can't leave their own team - see removeTeamMember.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id, userId } = await params;
  const result = await removeTeamMember(id, userId, ctx.user.id);

  if (!result.ok) {
    if (result.reason === "not_allowed") {
      return NextResponse.json({ error: "Only the team owner can remove members" }, { status: 403 });
    }
    if (result.reason === "owner_must_delist") {
      return NextResponse.json({ error: "The owner can't leave - delist the team instead." }, { status: 400 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
