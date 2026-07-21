import { NextResponse } from "next/server";
import { createGuild, listMyGuilds, listRaidTeams } from "@/data/guilds";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { parseRaidTeamFilters } from "@/server/recruitmentHttp";
import { enforceLimit } from "@/server/rateLimit";
import { guildInputSchema } from "./schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** Browse returns raid TEAMS, not guilds: a raider is shopping for a roster
 * with an opening on nights they can make, not for a guild name. `?mine=1`
 * switches to the caller's own guilds for the My Recruitment tab. */
export async function GET(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const url = new URL(req.url);
  if (url.searchParams.get("mine") === "1") {
    const ctx = await getSessionUser();
    if (!ctx) return notAuthenticated();
    return NextResponse.json({ guilds: await listMyGuilds(ctx.user.id) });
  }
  // Public browse, but blocked owners are hidden for a signed-in viewer.
  const viewer = await getSessionUser();
  return NextResponse.json({
    teams: await listRaidTeams({ ...parseRaidTeamFilters(req.url), viewerUserId: viewer?.user.id }),
  });
}

export async function POST(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, guildInputSchema);
  if (!body.ok) return body.response;

  const limited = await enforceLimit("create_guild", ctx.user.id);
  if (limited) return limited;

  const guild = await createGuild(ctx.user.id, body.data);
  return NextResponse.json({ id: guild.id, guild });
}
