import { NextResponse } from "next/server";
import { deleteRaidTeam, getRaidTeam, setRaidTeamStatus, updateRaidTeam } from "@/data/guilds";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsRaidTeam } from "@/data/recruitmentShared";
import { notFound, notOwned } from "@/server/recruitmentHttp";
import { guildStatusInputSchema, raidTeamInputSchema } from "../../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

// Teams are addressed at the top level rather than nested under their guild:
// every caller past the create step already has a team id, and nesting would
// force the guild id into every link for no gain. Ownership still resolves
// through the guild (ownsRaidTeam).
type Ctx = { params: Promise<{ teamId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { teamId } = await params;
  const team = await getRaidTeam(teamId);
  if (!team) return notFound("Raid team");
  return NextResponse.json({ team });
}

export async function PATCH(req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { teamId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsRaidTeam(ctx.user.id, teamId))) return notOwned("raid team");

  // One endpoint, two shapes: a status-only body pauses or closes the team,
  // anything else is a full edit. Status is tried first because it is the
  // strictly narrower shape.
  const raw = await req.clone().json().catch(() => null);
  if (raw && typeof raw === "object" && Object.keys(raw).length === 1 && "status" in raw) {
    const body = await parseBody(req, guildStatusInputSchema);
    if (!body.ok) return body.response;
    return NextResponse.json({ team: await setRaidTeamStatus(teamId, body.data.status) });
  }

  const body = await parseBody(req, raidTeamInputSchema);
  if (!body.ok) return body.response;
  return NextResponse.json({ team: await updateRaidTeam(teamId, body.data) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { teamId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsRaidTeam(ctx.user.id, teamId))) return notOwned("raid team");

  await deleteRaidTeam(teamId);
  return NextResponse.json({ ok: true });
}
