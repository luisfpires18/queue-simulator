import { NextResponse } from "next/server";
import {
  createRaiderProfile,
  hasProfileForCharacter,
  listMyRaiderProfiles,
  listRaiderProfiles,
} from "@/data/raiderProfiles";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { parseRaiderFilters } from "@/server/recruitmentHttp";
import { enforceLimit } from "@/server/rateLimit";
import { raiderProfileInputSchema } from "../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const url = new URL(req.url);
  if (url.searchParams.get("mine") === "1") {
    const ctx = await getSessionUser();
    if (!ctx) return notAuthenticated();
    return NextResponse.json({ profiles: await listMyRaiderProfiles(ctx.user.id) });
  }
  // Public browse, but blocked owners are hidden for a signed-in viewer.
  const viewer = await getSessionUser();
  return NextResponse.json({
    profiles: await listRaiderProfiles({ ...parseRaiderFilters(req.url), viewerUserId: viewer?.user.id }),
  });
}

export async function POST(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, raiderProfileInputSchema);
  if (!body.ok) return body.response;

  const limited = await enforceLimit("create_raider_profile", ctx.user.id);
  if (limited) return limited;

  const owned = await findOwnedCharacter(ctx.user.id, body.data.characterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  // One profile per character. Checked up front so a duplicate answers with a
  // sentence a user can act on, rather than a raw unique-constraint 500.
  if (await hasProfileForCharacter(ctx.user.id, body.data.characterId)) {
    return NextResponse.json(
      { error: "You already have a raider profile for this character. Edit that one instead." },
      { status: 409 }
    );
  }

  const profile = await createRaiderProfile(ctx.user.id, body.data);
  return NextResponse.json({ id: profile.id, profile });
}
