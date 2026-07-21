import { NextResponse } from "next/server";
import { deleteGuild, getGuild, updateGuild } from "@/data/guilds";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsGuild } from "@/data/recruitmentShared";
import { notFound, notOwned } from "@/server/recruitmentHttp";
import { guildInputSchema } from "../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const guild = await getGuild(id);
  if (!guild) return notFound("Guild");
  return NextResponse.json({ guild });
}

export async function PATCH(req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsGuild(ctx.user.id, id))) return notOwned("guild");

  const body = await parseBody(req, guildInputSchema);
  if (!body.ok) return body.response;

  return NextResponse.json({ guild: await updateGuild(id, body.data) });
}

/** Cascades to every raid team and position under the guild (see the schema's
 * onDelete: Cascade), which is why the UI confirms before calling this. */
export async function DELETE(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsGuild(ctx.user.id, id))) return notOwned("guild");

  await deleteGuild(id);
  return NextResponse.json({ ok: true });
}
