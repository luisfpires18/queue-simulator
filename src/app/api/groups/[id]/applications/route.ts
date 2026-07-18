import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureUser, listPendingApplications } from "@/data/source";
import type { Role } from "@/game/classes";

export const dynamic = "force-dynamic";

const VALID_ROLES: Role[] = ["TANK", "HEALER", "DPS"];

// Owner-only: pending applications to review, filtered to one role tab and
// paginated, ranked highest-rating-first. Returns an empty page (not 403)
// for a non-owner caller, matching listPendingApplications' own gate — this
// backs a UI list, not a sensitive endpoint worth distinguishing "empty"
// from "denied".
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) {
    return NextResponse.json({ applications: [], total: 0, page: 1, pageSize: 5, countsByRole: { TANK: 0, HEALER: 0, DPS: 0 } });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 5));
  const roleParam = searchParams.get("role");
  const role = VALID_ROLES.includes(roleParam as Role) ? (roleParam as Role) : null;

  const user = await ensureUser(s.bnetId, s.battletag);
  const { applications, total, countsByRole } = await listPendingApplications(id, user.id, role, page, pageSize);
  return NextResponse.json({ applications, total, page, pageSize, countsByRole });
}
