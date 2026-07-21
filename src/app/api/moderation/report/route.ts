import { NextResponse } from "next/server";
import { createReport } from "@/data/moderation";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { enforceLimit } from "@/server/rateLimit";
import type { ReportCategory, ReportTargetType } from "@/game/moderation";
import { reportInputSchema } from "../../recruitment/applications/schema";

export const dynamic = "force-dynamic";

/** Writes a report for an operator to read later. There is no admin UI this
 * phase, and no automated action is taken - the response says so rather than
 * implying something happened. */
export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, reportInputSchema);
  if (!body.ok) return body.response;

  // Reports are already bounded per target by a unique constraint, but not
  // across targets - this stops one user carpet-reporting a board.
  const limited = await enforceLimit("report", ctx.user.id);
  if (limited) return limited;

  await createReport({
    reporterUserId: ctx.user.id,
    targetType: body.data.targetType as ReportTargetType,
    targetId: body.data.targetId,
    category: body.data.category as ReportCategory,
    detail: body.data.detail,
  });

  return NextResponse.json({ ok: true });
}
