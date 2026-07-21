import { NextResponse } from "next/server";
import { deleteMPlusPost, getMPlusPost, updateMPlusPost } from "@/data/mplusRecruitment";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { ownsMPlusPost } from "@/data/recruitmentShared";
import { notFound, notOwned } from "@/server/recruitmentHttp";
import { mplusPostInputSchema } from "../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const post = await getMPlusPost(id);
  if (!post) return notFound();
  return NextResponse.json({ post });
}

export async function PATCH(req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsMPlusPost(ctx.user.id, id))) return notOwned();

  const body = await parseBody(req, mplusPostInputSchema);
  if (!body.ok) return body.response;

  // Re-checked on edit, not just create: otherwise an owner could swap in
  // someone else's character after the fact.
  for (const c of body.data.characters) {
    const owned = await findOwnedCharacter(ctx.user.id, c.characterId);
    if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });
  }

  const post = await updateMPlusPost(id, body.data);
  return NextResponse.json({ post });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsMPlusPost(ctx.user.id, id))) return notOwned();

  await deleteMPlusPost(id);
  return NextResponse.json({ ok: true });
}
