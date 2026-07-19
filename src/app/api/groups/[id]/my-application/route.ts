import { NextResponse } from "next/server";
import { getMyApplication, countDeclinedApplications } from "@/data/applications";
import { getSessionUser } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return NextResponse.json({ application: null, declinedCount: 0 });

  const { id } = await params;
  const [application, declinedCount] = await Promise.all([
    getMyApplication(id, ctx.user.id),
    countDeclinedApplications(id, ctx.user.id),
  ]);
  return NextResponse.json({ application, declinedCount });
}
