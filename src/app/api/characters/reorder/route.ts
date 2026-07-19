import { NextResponse } from "next/server";
import { z } from "zod";
import { reorderBucket } from "@/data/characters";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  bucket: z.enum(["main", "alt", "hidden"]),
  orderedIds: z.array(z.string()),
});

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, schema, "Bad request");
  if (!body.ok) return body.response;

  await reorderBucket(ctx.user.id, body.data.bucket, body.data.orderedIds);
  return NextResponse.json({ ok: true });
}
