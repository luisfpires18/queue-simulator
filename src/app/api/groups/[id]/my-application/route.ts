import { NextResponse } from "next/server";
import { getMyApplication, countDeclinedApplications } from "@/data/applications";
import { getLastDeclinesByListing } from "@/data/declineRecords";
import { getSessionUser } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return NextResponse.json({ application: null, declinedCount: 0, lastDecline: null });

  const { id } = await params;
  const [application, declinedCount, lastDeclines] = await Promise.all([
    getMyApplication(id, ctx.user.id),
    countDeclinedApplications(id, ctx.user.id),
    getLastDeclinesByListing(ctx.user.id, [id]),
  ]);
  // Only while the latest application is the declined one - see the same
  // guard in getMyApplicationsByGroup.
  const lastDecline = application?.status === "declined" ? lastDeclines[id] ?? null : null;
  return NextResponse.json({ application, declinedCount, lastDecline });
}
