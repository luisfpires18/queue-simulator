import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureUser, reorderBucket } from "@/data/source";

export const dynamic = "force-dynamic";

const schema = z.object({
  bucket: z.enum(["main", "alt", "hidden"]),
  orderedIds: z.array(z.string()),
});

export async function POST(req: Request) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const user = await ensureUser(s.bnetId, s.battletag);
  await reorderBucket(user.id, parsed.data.bucket, parsed.data.orderedIds);
  return NextResponse.json({ ok: true });
}
