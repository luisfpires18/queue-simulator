import { NextResponse } from "next/server";
import { setPositionFilled } from "@/data/mplusRecruitment";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsMPlusPost } from "@/data/recruitmentShared";
import { notOwned } from "@/server/recruitmentHttp";
import { positionFilledSchema } from "../../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** Marks one position filled or reopened. Filling the last open position
 * flips the whole post to "filled" automatically (see statusAfterPositionChange
 * in src/game/expiry.ts), so a team that finished recruiting stops appearing
 * in browse without anyone remembering to close it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsMPlusPost(ctx.user.id, id))) return notOwned();

  const body = await parseBody(req, positionFilledSchema);
  if (!body.ok) return body.response;

  const post = await setPositionFilled(id, body.data.positionId, body.data.isFilled);
  // null means the position id was not on this post - a 404 rather than a
  // silent success, so a bad id is never mistaken for a completed change.
  if (!post) return NextResponse.json({ error: "Position not found on this post" }, { status: 404 });
  return NextResponse.json({ post });
}
