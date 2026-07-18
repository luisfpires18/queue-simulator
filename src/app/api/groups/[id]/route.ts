import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, updateGroup, deleteGroup } from "@/data/source";
import { prisma } from "@/lib/prisma";
import { groupInputSchema } from "../schema";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const parsed = groupInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  const owned = await prisma.character.findFirst({
    where: { id: parsed.data.ownerCharacterId, userId: user.id },
  });
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  const ok = await updateGroup(id, user.id, parsed.data);
  if (!ok) return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const user = await ensureUser(s.bnetId, s.battletag);
  const ok = await deleteGroup(id, user.id);
  if (!ok) return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
