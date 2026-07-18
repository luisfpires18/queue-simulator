import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/data/source";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth_ = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth_) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const user = await ensureUser(s.bnetId, s.battletag);
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth: auth_ },
    update: { userId: user.id, p256dh, auth: auth_ },
  });

  return NextResponse.json({ ok: true });
}
