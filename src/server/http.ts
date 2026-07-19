// Shared plumbing for the non-wcl /api/* route handlers: resolving the
// signed-in Battle.net session, materializing its User row, character
// ownership, and body validation. The /api/wcl/* routes keep their own
// helpers (src/server/wclHelpers.ts) — those throw ApiError and their
// requireUser deliberately never refreshes battletag, so merging the two
// would change response bodies.
import { NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { prisma } from "@/lib/prisma";

export type BnetSession = { bnetId: string; battletag?: string; accessToken?: string };

/** The signed-in Battle.net session, or null. */
export async function getBnetSession(): Promise<BnetSession | null> {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string; accessToken?: string }) | null;
  if (!s?.bnetId) return null;
  return { bnetId: s.bnetId, battletag: s.battletag, accessToken: s.accessToken };
}

/** Session plus its materialized User row, or null when not signed in. */
export async function getSessionUser() {
  const s = await getBnetSession();
  if (!s) return null;
  const user = await ensureUser(s.bnetId, s.battletag);
  return { user, session: s };
}

export function notAuthenticated() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/** The character, if it belongs to this user; null otherwise. */
export function findOwnedCharacter(userId: string, characterId: string) {
  return prisma.character.findFirst({ where: { id: characterId, userId } });
}

/** Zod-parses a JSON body. On failure returns the canonical 400 — zod's
 * flattened issues by default, or a fixed message where the route has always
 * answered with one (e.g. "Bad request"). */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  fixedError?: string
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: fixedError ?? parsed.error.flatten() }, { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}
