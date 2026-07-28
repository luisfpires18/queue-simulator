import { NextResponse } from "next/server";
import { listPendingTeamApplications } from "@/data/teamApplications";
import type { Role } from "@/game/classes";
import { getSessionUser } from "@/server/http";

export const dynamic = "force-dynamic";

const VALID_ROLES: Role[] = ["TANK", "HEALER", "DPS"];

// Owner-only, same convention as the group equivalent: a non-owner (or
// signed-out) caller gets an empty page rather than a 403, since this backs a
// UI list whose "empty" and "denied" states render identically.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) {
    return NextResponse.json({ applications: [], total: 0, page: 1, pageSize: 5, countsByRole: { TANK: 0, HEALER: 0, DPS: 0 } });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 5));
  const roleParam = searchParams.get("role");
  const role = VALID_ROLES.includes(roleParam as Role) ? (roleParam as Role) : null;

  const { applications, total, countsByRole } = await listPendingTeamApplications(id, ctx.user.id, role, page, pageSize);
  return NextResponse.json({ applications, total, page, pageSize, countsByRole });
}
