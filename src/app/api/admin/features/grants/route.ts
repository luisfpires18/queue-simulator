import { NextResponse } from "next/server";
import { z } from "zod";
import { grantAccess, listGrants, revokeAccess } from "@/data/features";
import { isFeatureKey } from "@/game/features";
import { getAdminUser, notFoundForNonAdmin } from "@/server/admin";
import { parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.string().refine(isFeatureKey, { message: "Unknown feature." }),
  // A Battle.net id, not a userId - the grant deliberately works for someone
  // who has never signed in, so there is no User row to validate against.
  bnetId: z.string().trim().min(1).max(64),
  note: z.string().max(200).nullish(),
});

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  await grantAccess(body.data.key, body.data.bnetId, body.data.note);
  return NextResponse.json({ grants: await listGrants(body.data.key) });
}

export async function DELETE(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const body = await parseBody(req, schema.pick({ key: true, bnetId: true }));
  if (!body.ok) return body.response;

  await revokeAccess(body.data.key, body.data.bnetId);
  return NextResponse.json({ grants: await listGrants(body.data.key) });
}
