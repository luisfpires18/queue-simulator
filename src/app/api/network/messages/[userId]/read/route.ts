import { NextResponse } from "next/server";
import { markThreadRead } from "@/data/messages";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { userId } = await params;
  await markThreadRead(ctx.user.id, userId);
  return NextResponse.json({ ok: true });
}
