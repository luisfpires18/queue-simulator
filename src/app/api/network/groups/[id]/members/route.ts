import { NextResponse } from "next/server";
import { z } from "zod";
import { addChatGroupMember } from "@/data/chatGroups";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const addSchema = z.object({ userId: z.string().min(1) });

// Owner-only — and the owner must be friends with whoever they're adding,
// same rule as group creation (see createChatGroup).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, addSchema);
  if (!body.ok) return body.response;

  const result = await addChatGroupMember(id, ctx.user.id, body.data.userId);
  if (!result.ok) {
    if (result.reason === "not_owner") return NextResponse.json({ error: "Only the group owner can add members" }, { status: 403 });
    if (result.reason === "not_friends") return NextResponse.json({ error: "You're not friends with that player" }, { status: 409 });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
