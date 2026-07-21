import { NextResponse } from "next/server";
import { z } from "zod";
import { listFeatureStates, listGrants, setVisibility } from "@/data/features";
import { isFeatureKey, isVisibility } from "@/game/features";
import { getAdminUser, notFoundForNonAdmin } from "@/server/admin";
import { parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  key: z.string().refine(isFeatureKey, { message: "Unknown feature." }),
  visibility: z.string().refine(isVisibility, { message: "Unknown visibility." }),
  note: z.string().max(500).nullish(),
});

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const states = await listFeatureStates();
  // Grants come along so the dashboard renders in one round trip.
  const grants = Object.fromEntries(
    await Promise.all(states.map(async (s) => [s.feature.key, await listGrants(s.feature.key)] as const))
  );

  return NextResponse.json({ features: states, grants });
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  // The zod refinements above already constrained these to the known sets, so
  // a bad key can never create a stray flag row.
  await setVisibility(body.data.key, body.data.visibility as never, body.data.note);
  return NextResponse.json({ features: await listFeatureStates() });
}
