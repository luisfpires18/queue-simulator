import { NextResponse } from "next/server";
import {
  createApplication,
  listApplicationsForTarget,
  listMyApplications,
  type ApplyFailure,
} from "@/data/recruitmentApplications";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { enforceLimit } from "@/server/rateLimit";
import { notifyApplicationReceived } from "@/server/notifications/recruitment";
import { applyInputSchema } from "./schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

/** `?mine=1` returns the caller's own applications; `?targetId=&type=` returns
 * the recruiter view for a listing they own. Both require a session. */
export async function GET(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const url = new URL(req.url);
  const targetId = url.searchParams.get("targetId");
  const recruitmentType = url.searchParams.get("type") ?? "mplus";

  if (targetId) {
    // Owner-gated inside the data layer, which returns an empty list rather
    // than throwing for a listing the caller does not own.
    const applications = await listApplicationsForTarget(recruitmentType, targetId, ctx.user.id, {
      includeSettled: url.searchParams.get("all") === "1",
    });
    return NextResponse.json({ applications });
  }

  const applications = await listMyApplications(ctx.user.id, {
    recruitmentType: url.searchParams.get("type") ?? undefined,
  });
  return NextResponse.json({ applications });
}

/** Each refusal gets its own status and a sentence the user can act on.
 *
 * "blocked" deliberately does NOT say a block exists - telling an applicant
 * they were blocked leaks exactly what blocking is meant to hide, so it reads
 * as the listing being unavailable. */
const APPLY_FAILURES: Record<ApplyFailure, { status: number; error: string }> = {
  target_not_found: { status: 404, error: "That listing no longer exists." },
  target_closed: { status: 409, error: "That listing is no longer accepting applications." },
  own_post: { status: 400, error: "You cannot apply to your own listing." },
  character_not_owned: { status: 403, error: "Character not yours" },
  blocked: { status: 409, error: "That listing is not accepting applications from you." },
};

export async function POST(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, applyInputSchema);
  if (!body.ok) return body.response;

  // Checked after validation so a malformed body does not burn a slot, and
  // before the write so a refused request never creates a row.
  const limited = await enforceLimit("apply", ctx.user.id);
  if (limited) return limited;

  const result = await createApplication(ctx.user.id, body.data);
  if (!result.ok) {
    const { status, error } = APPLY_FAILURES[result.reason];
    return NextResponse.json({ error }, { status });
  }

  // Fire-and-forget, matching the live board's notify pattern - a push failure
  // must never fail the application itself.
  notifyApplicationReceived(result.application).catch((err) =>
    console.error("notifyApplicationReceived failed", err)
  );

  return NextResponse.json({ id: result.application.id, application: result.application });
}
