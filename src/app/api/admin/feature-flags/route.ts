import { NextResponse } from "next/server";
import { z } from "zod";
import { getBnetSession, parseBody } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { listFeatureFlags, setFeatureFlag } from "@/data/featureFlags";
import { FEATURE_FLAGS } from "@/game/featureFlags";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  key: z.enum(FEATURE_FLAGS.map((f) => f.key) as [string, ...string[]]),
  enabled: z.boolean(),
});

export async function GET() {
  const session = await getBnetSession();
  // 404, not 401/403 - same as every other /api/admin/* route, this
  // shouldn't confirm its own existence to anyone but the admin account.
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const flags = await listFeatureFlags();
  return NextResponse.json({ flags });
}

export async function PATCH(req: Request) {
  const session = await getBnetSession();
  if (!isAdminBattletag(session?.battletag)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  await setFeatureFlag(body.data.key, body.data.enabled);
  return NextResponse.json({ ok: true });
}
