import { NextResponse } from "next/server";
import { createMPlusPost, listMPlusPosts, listMyMPlusPosts } from "@/data/mplusRecruitment";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { parseMPlusFilters } from "@/server/recruitmentHttp";
import { enforceLimit } from "@/server/rateLimit";
import { mplusPostInputSchema } from "./schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** `?mine=1` returns the caller's own posts including paused and expired ones
 * (the My Recruitment tab); otherwise this is the public browse query. */
export async function GET(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const url = new URL(req.url);
  if (url.searchParams.get("mine") === "1") {
    const ctx = await getSessionUser();
    if (!ctx) return notAuthenticated();
    return NextResponse.json({ posts: await listMyMPlusPosts(ctx.user.id) });
  }
  // Browse is public, but a signed-in viewer gets blocked owners filtered out.
  // getSessionUser returns null for anonymous callers rather than erroring, so
  // this stays a single unauthenticated-friendly path.
  const viewer = await getSessionUser();
  return NextResponse.json({
    posts: await listMPlusPosts({ ...parseMPlusFilters(req.url), viewerUserId: viewer?.user.id }),
  });
}

export async function POST(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, mplusPostInputSchema);
  if (!body.ok) return body.response;

  const limited = await enforceLimit("create_mplus_post", ctx.user.id);
  if (limited) return limited;

  // Every character on the post must belong to the caller. Without this,
  // anyone could publish a post claiming someone else's 3.5k main as their
  // roster.
  //
  // The cost is that a team leader can only list THEIR OWN characters as
  // current roster in this phase - teammates' characters join a post when they
  // are accepted through an application (phase 2), which is the only path that
  // proves consent. Until then a team post carries the leader plus its open
  // positions, which is what browse actually filters on.
  for (const c of body.data.characters) {
    const owned = await findOwnedCharacter(ctx.user.id, c.characterId);
    if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });
  }

  const post = await createMPlusPost(ctx.user.id, body.data);
  return NextResponse.json({ id: post.id, post });
}
