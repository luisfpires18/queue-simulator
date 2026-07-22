import { NextResponse } from "next/server";
import { getBnetSession } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { listUsers, type UserFilter } from "@/data/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const session = await getBnetSession();
  // 404, not 401/403 - this endpoint shouldn't confirm its own existence to
  // anyone but the one account allowed to use it.
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const filterRaw = searchParams.get("filter");
  const filter: UserFilter = filterRaw === "hasCharacters" || filterRaw === "noCharacters" ? filterRaw : "all";
  const search = searchParams.get("search") ?? undefined;

  const { rows, total } = await listUsers({ search, filter, page, pageSize: PAGE_SIZE });
  return NextResponse.json({ rows, total, page, pageSize: PAGE_SIZE });
}
