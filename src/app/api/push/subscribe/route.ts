import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, schema, "Invalid subscription");
  if (!body.ok) return body.response;

  const { endpoint, keys } = body.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: ctx.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: ctx.user.id, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}
