import { NextResponse } from "next/server";
import { blockUser, listBlocks, unblockUser } from "@/data/moderation";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { blockInputSchema } from "../../recruitment/applications/schema";

export const dynamic = "force-dynamic";

/** The caller's own block list. There is deliberately no way to ask who has
 * blocked YOU - that would tell a blocked user they were blocked, which is
 * what blocking exists to avoid. */
export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  return NextResponse.json({ blocks: await listBlocks(ctx.user.id) });
}

/** One endpoint for both directions so the UI toggle is a single call. */
export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, blockInputSchema);
  if (!body.ok) return body.response;

  if (body.data.blocked) {
    await blockUser(ctx.user.id, body.data.blockedUserId, body.data.reason);
  } else {
    await unblockUser(ctx.user.id, body.data.blockedUserId);
  }
  return NextResponse.json({ ok: true, blocked: body.data.blocked });
}
