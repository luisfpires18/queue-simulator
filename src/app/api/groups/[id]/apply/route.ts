import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureUser, createApplication, getGroup, countDeclinedApplications } from "@/data/source";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  characterId: z.string(),
  specId: z.string(),
  role: z.enum(["TANK", "HEALER", "DPS"]),
  note: z.string().max(500).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const parsed = applySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const group = await getGroup(id);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (group.slots.length === 0) {
    return NextResponse.json({ error: "This group is full" }, { status: 400 });
  }

  const user = await ensureUser(s.bnetId, s.battletag);
  if (group.ownerUserId === user.id) {
    return NextResponse.json({ error: "You can't apply to your own key" }, { status: 400 });
  }

  const owned = await prisma.character.findFirst({
    where: { id: parsed.data.characterId, userId: user.id },
  });
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  const declines = await countDeclinedApplications(id, user.id);
  if (declines >= MAX_APPLICATION_DECLINES) {
    return NextResponse.json({ error: "You've already been declined twice for this key" }, { status: 400 });
  }

  const application = await createApplication(user.id, { groupId: id, ...parsed.data });
  return NextResponse.json({ application });
}
