import { NextResponse } from "next/server";
import { applyToTeam } from "@/data/teamApplications";
import { getMyTeam, getTeam } from "@/data/teams";
import { getSpecTracks } from "@/data/characters";
import { countDeclinesByListing } from "@/data/declineRecords";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { minRatingFailure } from "@/server/guards";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { teamApplySchema } from "../../schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, teamApplySchema);
  if (!body.ok) return body.response;

  const team = await getTeam(id);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.slots.length === 0) {
    return NextResponse.json({ error: "This team isn't recruiting right now" }, { status: 400 });
  }
  if (!team.slots.some((s) => s.role === body.data.role)) {
    return NextResponse.json({ error: `This team isn't recruiting a ${body.data.role.toLowerCase()}` }, { status: 400 });
  }

  const mine = await getMyTeam(ctx.user.id);
  if (mine) {
    return NextResponse.json(
      { error: mine.id === id ? "You're already in this team." : `You're already in "${mine.name}". Leave it before applying elsewhere.` },
      { status: 409 }
    );
  }

  const owned = await findOwnedCharacter(ctx.user.id, body.data.characterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  // Same two-attempt cap as a key listing. Counted from DeclineRecord because
  // a re-apply upserts the TeamApplication row - see countDeclinesByListing.
  const declines = await countDeclinesByListing(ctx.user.id, "team", [id]);
  if ((declines[id] ?? 0) >= MAX_APPLICATION_DECLINES) {
    return NextResponse.json({ error: "You've already been declined twice by this team" }, { status: 400 });
  }

  // Same hard gate as a rating-requirement key: below the bar simply can't apply.
  if (team.requirementType === "rating" && team.reqRating != null) {
    const specTracks = await getSpecTracks(body.data.characterId);
    const failed = minRatingFailure(team, specTracks, body.data.specId);
    if (failed) {
      return NextResponse.json(
        { error: `This team requires ${failed.required}+ rating (you have ${failed.score < 0 ? "no rating yet" : Math.round(failed.score)}).` },
        { status: 403 }
      );
    }
  }

  const application = await applyToTeam(ctx.user.id, { teamId: id, ...body.data });
  return NextResponse.json({ application });
}
