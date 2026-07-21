import { NextResponse } from "next/server";
import {
  setApplicationStatus,
  setRecruiterNote,
  withdrawApplication,
  type TransitionFailure,
} from "@/data/recruitmentApplications";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";
import { notifyApplicationStatus, notifyPositionsFilled } from "@/server/notifications/recruitment";
import { recruiterNoteSchema, statusInputSchema } from "../schema";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TRANSITION_FAILURES: Record<TransitionFailure, { status: number; error: string }> = {
  not_found: { status: 404, error: "Application not found" },
  not_authorized: { status: 403, error: "Not your application" },
  // Covers both "that move is not allowed from here" and "someone else got
  // there first" - the application has moved on since the page was rendered.
  illegal_transition: { status: 409, error: "That is no longer a valid action for this application." },
  position_taken: { status: 409, error: "That position has already been filled." },
};

/** One endpoint, two shapes: a `status` body is a transition, a
 * `recruiterNote` body is the private note. Status is tried first because it
 * is the narrower shape - same split as the raid team route. */
export async function PATCH(req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const raw = await req.clone().json().catch(() => null);

  if (raw && typeof raw === "object" && "recruiterNote" in raw) {
    const body = await parseBody(req, recruiterNoteSchema);
    if (!body.ok) return body.response;

    const ok = await setRecruiterNote(id, ctx.user.id, body.data.recruiterNote ?? null);
    if (!ok) return NextResponse.json({ error: "Not your application" }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  const body = await parseBody(req, statusInputSchema);
  if (!body.ok) return body.response;

  const result = await setApplicationStatus(id, ctx.user.id, body.data.status);
  if (!result.ok) {
    const { status, error } = TRANSITION_FAILURES[result.reason];
    return NextResponse.json({ error }, { status });
  }

  // Fire-and-forget: a push failure must never fail the transition.
  notifyApplicationStatus(result.application).catch((err) =>
    console.error("notifyApplicationStatus failed", err)
  );
  if (result.autoClosed) {
    notifyPositionsFilled(result.application).catch((err) =>
      console.error("notifyPositionsFilled failed", err)
    );
  }

  return NextResponse.json({ application: result.application, autoClosed: result.autoClosed });
}

/** Withdraw. Routed through the same actor rules as PATCH, so a recruiter
 * cannot withdraw an application on someone else's behalf. */
export async function DELETE(_req: Request, { params }: Ctx) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("recruitment");
  if (gate) return gate;

  const { id } = await params;
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const result = await withdrawApplication(id, ctx.user.id);
  if (!result.ok) {
    const { status, error } = TRANSITION_FAILURES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ application: result.application });
}
