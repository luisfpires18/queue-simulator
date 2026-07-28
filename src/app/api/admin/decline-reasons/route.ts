import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getBnetSession, parseBody } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { createDeclineReason, listAllDeclineReasons, DECLINE_REASONS_TAG } from "@/data/declineReasons";

export const dynamic = "force-dynamic";

const createSchema = z.object({ label: z.string().trim().min(1).max(80) });

export async function GET() {
  const session = await getBnetSession();
  // 404, not 401/403 - same as every other /api/admin/* route, this
  // shouldn't confirm its own existence to anyone but the admin account.
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reasons = await listAllDeclineReasons();
  return NextResponse.json({ reasons });
}

export async function POST(req: Request) {
  const session = await getBnetSession();
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const reason = await createDeclineReason(body.data.label);
  revalidateTag(DECLINE_REASONS_TAG);
  return NextResponse.json({ reason });
}
