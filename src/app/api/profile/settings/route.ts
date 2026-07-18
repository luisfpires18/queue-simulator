import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/data/source";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/game/countries";

export const dynamic = "force-dynamic";

async function currentUser() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return null;
  return ensureUser(s.bnetId, s.battletag);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({ showBattletag: user.showBattletag, country: user.country });
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.showBattletag !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (body.country != null && (typeof body.country !== "string" || !COUNTRIES.some((c) => c.code === body.country))) {
    return NextResponse.json({ error: "Invalid country" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { showBattletag: body.showBattletag, country: body.country ?? null },
  });

  return NextResponse.json({ showBattletag: updated.showBattletag, country: updated.country });
}
