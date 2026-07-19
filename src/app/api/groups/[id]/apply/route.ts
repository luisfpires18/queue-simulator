import { NextResponse } from "next/server";
import { z } from "zod";
import { createApplication, countDeclinedApplications } from "@/data/applications";
import { getGroup, findSchedulingConflict } from "@/data/groups";
import { getSpecTracks } from "@/data/characters";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { minRatingFailure } from "@/server/guards";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  characterId: z.string(),
  specId: z.string(),
  role: z.enum(["TANK", "HEALER", "DPS"]),
  note: z.string().max(500).nullish(),
  // The applicant's proposed Mythic Dungeon Tools route - only meaningful
  // (and only ever sent) when role="TANK" on an mplus group; always optional.
  route: z.string().max(4000).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, applySchema);
  if (!body.ok) return body.response;

  const group = await getGroup(id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (group.slots.length === 0) {
    return NextResponse.json({ error: "This group is full" }, { status: 400 });
  }

  if (group.ownerUserId === ctx.user.id) {
    return NextResponse.json({ error: "You can't apply to your own key" }, { status: 400 });
  }

  const owned = await findOwnedCharacter(ctx.user.id, body.data.characterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  const declines = await countDeclinedApplications(id, ctx.user.id);
  if (declines >= MAX_APPLICATION_DECLINES) {
    return NextResponse.json({ error: "You've already been declined twice for this key" }, { status: 400 });
  }

  // A "min rating" requirement is a hard gate, not just the advisory badge
  // shown to the owner - too low a rating simply can't apply.
  if (group.requirementType === "rating" && group.reqRating != null) {
    const specTracks = await getSpecTracks(body.data.characterId);
    const failed = minRatingFailure(group, specTracks, body.data.specId);
    if (failed) {
      return NextResponse.json(
        { error: `This key requires ${failed.required}+ rating (you have ${failed.score < 0 ? "no rating yet" : Math.round(failed.score)}).` },
        { status: 403 }
      );
    }
  }

  // Soft pre-check so applicants don't waste an application on a listing
  // they could never actually join - acceptApplication re-checks this
  // authoritatively at accept time (see findSchedulingConflict).
  const conflict = await findSchedulingConflict(ctx.user.id, group.startsAt, id);
  if (conflict) {
    return NextResponse.json(
      { error: `You're already committed to "${conflict.title}" around that time.` },
      { status: 409 }
    );
  }

  const application = await createApplication(ctx.user.id, { groupId: id, ...body.data });
  return NextResponse.json({ application });
}
