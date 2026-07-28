import { NextResponse } from "next/server";
import { listDeclineRecords, type DeclineSide } from "@/data/declineRecords";
import { getSessionUser } from "@/server/http";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

/** The caller's own decline history, either side of it. Private by
 * construction: the filter is always ctx.user.id, so there is no id to pass
 * and nothing to authorize beyond being signed in. */
export async function GET(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return NextResponse.json({ records: [], total: 0, page: 1, pageSize: PAGE_SIZE });

  const { searchParams } = new URL(req.url);
  const side: DeclineSide = searchParams.get("side") === "given" ? "given" : "received";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const { records, total } = await listDeclineRecords(ctx.user.id, side, page, PAGE_SIZE);
  return NextResponse.json({ records, total, page, pageSize: PAGE_SIZE });
}
