import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getBnetSession, parseBody } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { updateDeclineReason, DECLINE_REASONS_TAG } from "@/data/declineReasons";

export const dynamic = "force-dynamic";

// No DELETE on purpose: history rows reference a reason by id, so retiring
// one is `active: false`, never a row removal.
const patchSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getBnetSession();
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const reason = await updateDeclineReason(id, body.data);
  if (!reason) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidateTag(DECLINE_REASONS_TAG);
  return NextResponse.json({ reason });
}
