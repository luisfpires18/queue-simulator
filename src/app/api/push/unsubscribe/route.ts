import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(2000) });

export async function POST(req: Request) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string }) | null;
  if (!s?.bnetId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await parseBody(req, unsubscribeSchema, "Missing endpoint");
  if (!body.ok) return body.response;

  // Scoped to the caller's own bnetId regardless of what endpoint value is
  // sent - this can only ever delete the caller's own subscription rows.
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.data.endpoint, user: { bnetId: s.bnetId } } });

  return NextResponse.json({ ok: true });
}
