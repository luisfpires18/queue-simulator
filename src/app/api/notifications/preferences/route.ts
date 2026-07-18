import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser } from "@/data/source";
import { prisma } from "@/lib/prisma";

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

  const pref = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    enabled: pref?.enabled ?? false,
    settings: pref ? JSON.parse(pref.settings) : {},
  });
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
  const mergedSettings = { ...(existing ? JSON.parse(existing.settings) : {}), ...(body.settings ?? {}) };

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, enabled: body.enabled, settings: JSON.stringify(mergedSettings) },
    update: { enabled: body.enabled, settings: JSON.stringify(mergedSettings) },
  });

  return NextResponse.json({ enabled: pref.enabled, settings: JSON.parse(pref.settings) });
}
