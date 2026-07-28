import { NextResponse } from "next/server";
import { getMyTeamApplication } from "@/data/teamApplications";
import { countDeclinesByListing, getLastDeclinesByListing } from "@/data/declineRecords";
import { getSessionUser } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return NextResponse.json({ application: null, lastDecline: null, declinedCount: 0 });

  const { id } = await params;
  const [application, lastDeclines, declineCounts] = await Promise.all([
    getMyTeamApplication(id, ctx.user.id),
    getLastDeclinesByListing(ctx.user.id, [id]),
    countDeclinesByListing(ctx.user.id, "team", [id]),
  ]);
  const lastDecline = application?.status === "declined" ? lastDeclines[id] ?? null : null;
  return NextResponse.json({ application, lastDecline, declinedCount: declineCounts[id] ?? 0 });
}
