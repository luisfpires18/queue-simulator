import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, getMyApplication, countDeclinedApplications } from "@/data/source";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ application: null, declinedCount: 0 });

  const { id } = await params;
  const user = await ensureUser(s.bnetId, s.battletag);
  const [application, declinedCount] = await Promise.all([
    getMyApplication(id, user.id),
    countDeclinedApplications(id, user.id),
  ]);
  return NextResponse.json({ application, declinedCount });
}
