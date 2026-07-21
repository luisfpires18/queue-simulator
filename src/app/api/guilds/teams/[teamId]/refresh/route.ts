import { NextResponse } from "next/server";
import { refreshRaidTeam } from "@/data/guilds";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { ownsRaidTeam } from "@/data/recruitmentShared";
import { notOwned } from "@/server/recruitmentHttp";
import { refreshInputSchema } from "../../../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** Unlike the M+ refresh, this requires an explicit `stillRecruiting: true`.
 * A guild listing lives 30 days, long enough that a one-click bump would keep
 * dead rosters circulating - so the confirmation is part of the contract. */
export async function POST(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("guilds");
  if (gate) return gate;

  const { teamId } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  if (!(await ownsRaidTeam(ctx.user.id, teamId))) return notOwned("raid team");

  const body = await parseBody(req, refreshInputSchema);
  if (!body.ok) return body.response;

  return NextResponse.json({ team: await refreshRaidTeam(teamId) });
}
