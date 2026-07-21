// The feature gate as pages and route handlers use it.
//
// Runs in the Node runtime, not edge middleware, for two reasons that are
// worth stating because they look like an omission otherwise:
//   1. src/auth.ts imports Prisma (for the dev-login provider), so `auth` is
//      not edge-safe.
//   2. the flags live in the database, so the check needs Prisma anyway.
// Hence Next layouts for pages (one gate covers every nested route) and an
// explicit assert in each route handler.
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdminBnetId } from "@/game/adminAllowlist";
import { canAccessFeature } from "@/game/features";
import { getVisibility, hasGrant } from "@/data/features";

/** Whether the CURRENT caller may see this feature. */
export async function canViewFeature(key: string): Promise<boolean> {
  const session = await auth();
  const bnetId = (session as (typeof session & { bnetId?: string }) | null)?.bnetId;

  const isAdmin = isAdminBnetId(bnetId);
  // Short-circuit: an admin passes at every visibility, so skip both queries.
  if (isAdmin) return true;

  const visibility = await getVisibility(key);
  // Only "allowlist" consults grants, so avoid the lookup otherwise.
  const isGranted =
    visibility === "allowlist" && bnetId ? await hasGrant(key, bnetId) : false;

  return canAccessFeature({ visibility, isAdmin, isGranted });
}

/** Resolves several features at once, for the nav. One auth() call rather than
 * one per link. */
export async function viewableFeatures(keys: readonly string[]): Promise<Set<string>> {
  const session = await auth();
  const bnetId = (session as (typeof session & { bnetId?: string }) | null)?.bnetId;

  if (isAdminBnetId(bnetId)) return new Set(keys);

  const out = new Set<string>();
  for (const key of keys) {
    const visibility = await getVisibility(key);
    const isGranted =
      visibility === "allowlist" && bnetId ? await hasGrant(key, bnetId) : false;
    if (canAccessFeature({ visibility, isAdmin: false, isGranted })) out.add(key);
  }
  return out;
}

/** Is the current caller an admin? Thin wrapper over the env allowlist that
 * resolves the session first - for the nav, which needs the answer without
 * caring about any particular feature. */
export async function viewerIsAdmin(): Promise<boolean> {
  const session = await auth();
  const bnetId = (session as (typeof session & { bnetId?: string }) | null)?.bnetId;
  return isAdminBnetId(bnetId);
}

/** Page gate. Renders the real 404 when refused.
 *
 * 404 rather than 403 for the same reason the admin surface does it: a 403
 * confirms the feature exists. Swap this one function for a teaser page if you
 * ever want the opposite. */
export async function requireFeature(key: string): Promise<void> {
  if (!(await canViewFeature(key))) notFound();
}

/** Route-handler gate. Returns the 404 response to return early, or null to
 * continue - the same shape as notFoundForNonAdmin in src/server/admin.ts. */
export async function assertFeature(key: string): Promise<NextResponse | null> {
  if (await canViewFeature(key)) return null;
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
