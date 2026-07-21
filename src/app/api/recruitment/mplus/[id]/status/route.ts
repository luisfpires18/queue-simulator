import { NextResponse } from "next/server";
import { setMPlusPostStatus } from "@/data/mplusRecruitment";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsMPlusPost } from "@/data/recruitmentShared";
import { notOwned } from "@/server/recruitmentHttp";
import { statusInputSchema } from "../../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** Pause / close / reopen. A paused post leaves browse but stays editable
 * under My Recruitment, so a team taking a week off does not have to recreate
 * its listing afterwards. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsMPlusPost(ctx.user.id, id))) return notOwned();

  const body = await parseBody(req, statusInputSchema);
  if (!body.ok) return body.response;

  return NextResponse.json({ post: await setMPlusPostStatus(id, body.data.status) });
}
