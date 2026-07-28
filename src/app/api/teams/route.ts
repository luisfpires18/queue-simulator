import { NextResponse } from "next/server";
import { createTeam, getMyTeam, listTeams } from "@/data/teams";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";
import { teamInputSchema } from "./schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const teams = await listTeams();
  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, teamInputSchema);
  if (!body.ok) return body.response;

  const owned = await findOwnedCharacter(ctx.user.id, body.data.ownerCharacterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  // One team per user. The @unique on TeamMember.userId would reject this
  // anyway; checking first turns it into a message the form can show.
  const existing = await getMyTeam(ctx.user.id);
  if (existing) {
    return NextResponse.json({ error: `You're already in "${existing.name}". Leave it before starting a new team.` }, { status: 409 });
  }

  const team = await createTeam(ctx.user.id, body.data);
  return NextResponse.json({ id: team.id });
}
