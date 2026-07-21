// Session-aware admin helpers for the moderation surface.
//
// The allowlist itself lives in src/game/adminAllowlist.ts, free of auth and
// Prisma imports so it can be tested without Next's runtime. This file adds
// only the session lookup on top.
import { NextResponse } from "next/server";
import { adminEnabled, isAdminBnetId } from "@/game/adminAllowlist";
import { getSessionUser, notAuthenticated } from "./http";

/** Session plus its User row, or null when the caller is not an admin. */
export async function getAdminUser() {
  const ctx = await getSessionUser();
  if (!ctx) return null;
  return isAdminBnetId(ctx.session.bnetId) ? ctx : null;
}

/** Answers a non-admin with 404 rather than 403.
 *
 * A 403 confirms the endpoint exists and that someone somewhere is an admin,
 * which is information a probe should not get for free. To anyone without the
 * privilege this surface simply does not exist. */
export function notFoundForNonAdmin() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export { adminEnabled, isAdminBnetId, notAuthenticated };
