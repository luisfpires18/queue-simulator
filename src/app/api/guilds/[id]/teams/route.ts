import { NextResponse } from "next/server";
import { createRaidTeam, getGuild } from "@/data/guilds";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsGuild } from "@/data/recruitmentShared";
import { notFound, notOwned } from "@/server/recruitmentHttp";
import { enforceLimit } from "@/server/rateLimit";
import { raidTeamInputSchema } from "../../schema";
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
  return NextResponse.json({ teams: guild.raidTeams });
}

/** One guild can run several teams (a Mythic roster and a casual Heroic one
 * recruit completely differently), so this is a create, never an upsert. */
export async function POST(req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsGuild(ctx.user.id, id))) return notOwned("guild");

  const body = await parseBody(req, raidTeamInputSchema);
  if (!body.ok) return body.response;

  const limited = await enforceLimit("create_raid_team", ctx.user.id);
  if (limited) return limited;

  const team = await createRaidTeam(id, body.data);
  return NextResponse.json({ id: team.id, team });
}
