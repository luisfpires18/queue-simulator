import { NextResponse } from "next/server";
import { refreshMPlusPost } from "@/data/mplusRecruitment";
import { getSessionUser, notAuthenticated } from "@/server/http";
import { ownsMPlusPost } from "@/data/recruitmentShared";
import { notOwned } from "@/server/recruitmentHttp";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** Pushes the 14-day expiry back out and re-floats the post in browse.
 * Deliberately its own endpoint rather than a side effect of PATCH, so fixing
 * a typo does not relaunch a stale listing to the top of the board. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsMPlusPost(ctx.user.id, id))) return notOwned();

  return NextResponse.json({ post: await refreshMPlusPost(id) });
}
