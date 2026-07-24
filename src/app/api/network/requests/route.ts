import { NextResponse } from "next/server";
import { z } from "zod";
import { listIncomingRequests, listOutgoingRequests, sendFriendRequest } from "@/data/network";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const sendSchema = z.object({ targetUserId: z.string().min(1) });

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const [incoming, outgoing] = await Promise.all([
    listIncomingRequests(ctx.user.id),
    listOutgoingRequests(ctx.user.id),
  ]);
  return NextResponse.json({ incoming, outgoing });
}

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, sendSchema);
  if (!body.ok) return body.response;

  const result = await sendFriendRequest(ctx.user.id, body.data.targetUserId);
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      self: "You can't friend yourself.",
      already_friends: "You're already friends.",
      already_pending: "There's already a pending request between you.",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 409 });
  }
  return NextResponse.json({ request: result.request });
}
