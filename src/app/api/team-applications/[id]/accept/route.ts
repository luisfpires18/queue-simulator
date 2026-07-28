import { NextResponse } from "next/server";
import { acceptTeamApplication } from "@/data/teamApplications";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const result = await acceptTeamApplication(id, ctx.user.id);
  if (!result.ok) {
    if (result.reason === "already_in_team") {
      return NextResponse.json({ error: "This applicant has joined another team since applying." }, { status: 409 });
    }
    if (result.reason === "below_requirement") {
      return NextResponse.json(
        { error: `This applicant no longer meets the ${result.requiredRating}+ rating requirement.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Not found, not yours, or already resolved" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
