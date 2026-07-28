import { NextResponse } from "next/server";
import { listActiveDeclineReasons } from "@/data/declineReasons";
import { getSessionUser } from "@/server/http";

export const dynamic = "force-dynamic";

/** The picker's options. Signed-in only - it's the vocabulary for an action
 * only a listing owner can take - but not owner-gated beyond that, since the
 * list is the same for everyone and carries nothing about any listing. */
export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return NextResponse.json({ reasons: [] });

  const reasons = await listActiveDeclineReasons();
  return NextResponse.json({ reasons });
}
