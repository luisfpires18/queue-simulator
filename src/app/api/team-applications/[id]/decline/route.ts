import { NextResponse } from "next/server";
import { z } from "zod";
import { declineTeamApplication } from "@/data/teamApplications";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

// Same contract as the group decline route - reason required, note optional.
const declineSchema = z.object({
  reasonId: z.string().min(1),
  note: z.string().max(500).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const body = await parseBody(req, declineSchema);
  if (!body.ok) return body.response;

  const result = await declineTeamApplication(id, ctx.user.id, body.data.reasonId, body.data.note);
  if (!result.ok) {
    if (result.reason === "invalid_reason") {
      return NextResponse.json({ error: "That decline reason is no longer available." }, { status: 400 });
    }
    return NextResponse.json({ error: "Not found, not yours, or already resolved" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
