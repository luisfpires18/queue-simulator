import { NextResponse } from "next/server";
import { declineApplication } from "@/data/applications";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { id } = await params;
  const ok = await declineApplication(id, ctx.user.id);
  if (!ok) return NextResponse.json({ error: "Not found, not yours, or already resolved" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
