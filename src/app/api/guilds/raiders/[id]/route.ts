import { NextResponse } from "next/server";
import {
  deleteRaiderProfile,
  getRaiderProfile,
  refreshRaiderProfile,
  setRaiderProfileStatus,
  updateRaiderProfile,
} from "@/data/raiderProfiles";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsRaiderProfile } from "@/data/recruitmentShared";
import { notFound, notOwned } from "@/server/recruitmentHttp";
import { raiderProfileInputSchema, raiderStatusInputSchema } from "../../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const profile = await getRaiderProfile(id);
  if (!profile) return notFound("Raider profile");
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsRaiderProfile(ctx.user.id, id))) return notOwned("raider profile");

  // Narrow status-only body handled first, same split as the raid team route.
  const raw = await req.clone().json().catch(() => null);
  if (raw && typeof raw === "object" && Object.keys(raw).length === 1 && "status" in raw) {
    const body = await parseBody(req, raiderStatusInputSchema);
    if (!body.ok) return body.response;
    return NextResponse.json({ profile: await setRaiderProfileStatus(id, body.data.status) });
  }

  const body = await parseBody(req, raiderProfileInputSchema);
  if (!body.ok) return body.response;
  return NextResponse.json({ profile: await updateRaiderProfile(id, body.data) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsRaiderProfile(ctx.user.id, id))) return notOwned("raider profile");

  await deleteRaiderProfile(id);
  return NextResponse.json({ ok: true });
}

/** POST on the same path refreshes - the profile has no other POST verb, and a
 * dedicated /refresh segment would be a file for one line. */
export async function POST(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsRaiderProfile(ctx.user.id, id))) return notOwned("raider profile");

  return NextResponse.json({ profile: await refreshRaiderProfile(id) });
}
