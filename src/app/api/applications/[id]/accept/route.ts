import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, acceptApplication } from "@/data/source";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const user = await ensureUser(s.bnetId, s.battletag);
  const ok = await acceptApplication(id, user.id);
  if (!ok) return NextResponse.json({ error: "Not found, not yours, or already resolved" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
