import { NextResponse } from "next/server";
import { createGroup, listGroups, findSchedulingConflict } from "@/data/groups";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { groupInputSchema } from "./schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const groups = await listGroups();
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, groupInputSchema);
  if (!body.ok) return body.response;

  // Ensure the chosen character belongs to this user.
  const owned = await findOwnedCharacter(ctx.user.id, body.data.ownerCharacterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  // Same 1-hour conflict window as joining someone else's key (see
  // findSchedulingConflict) - a listing more than an hour from any of your
  // other active commitments is fine (e.g. scheduling one for later while
  // one is currently forming), only genuinely overlapping times are blocked.
  const conflict = await findSchedulingConflict(ctx.user.id, body.data.startsAt ?? null);
  if (conflict) {
    return NextResponse.json(
      { error: `You're already committed to "${conflict.title}" around that time.` },
      { status: 409 }
    );
  }

  const group = await createGroup(ctx.user.id, body.data);
  return NextResponse.json({ id: group.id });
}
