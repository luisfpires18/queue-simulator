import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, createGroup, listGroups } from "@/data/source";
import { prisma } from "@/lib/prisma";
import { groupInputSchema } from "./schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const groups = await listGroups();
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = groupInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  // Ensure the chosen character belongs to this user.
  const owned = await prisma.character.findFirst({
    where: { id: parsed.data.ownerCharacterId, userId: user.id },
  });
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  const group = await createGroup(user.id, parsed.data);
  return NextResponse.json({ id: group.id });
}
