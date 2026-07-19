import { NextResponse } from "next/server";
import { z } from "zod";
import { joinSoloQueue, leaveSoloQueue, getMySoloQueueStatus } from "@/data/soloQueue";
import { runMatchPass } from "@/server/soloQueue/matchRunner";
import { getSessionUser, notAuthenticated, findOwnedCharacter, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const joinSchema = z.object({
  characterId: z.string(),
  specId: z.string(),
  role: z.enum(["TANK", "HEALER", "DPS"]),
  minKeyLevel: z.number().int().nullish(),
  maxKeyLevel: z.number().int().nullish(),
  dungeonIds: z.array(z.string()).optional(),
});

// The client polls this every 4s while queued (see SoloQueueClient) - piggyback
// a match pass on that poll too, not just the SSE board tick, so a player
// sitting alone on /solo-queue still gets retried without needing anyone
// else's /runs tab open to drive the board's interval.
export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  await runMatchPass();
  const status = await getMySoloQueueStatus(ctx.user.id);
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, joinSchema);
  if (!body.ok) return body.response;

  const owned = await findOwnedCharacter(ctx.user.id, body.data.characterId);
  if (!owned) return NextResponse.json({ error: "Character not yours" }, { status: 403 });

  await joinSoloQueue(ctx.user.id, body.data);
  const status = await getMySoloQueueStatus(ctx.user.id);
  return NextResponse.json(status);
}

export async function DELETE() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();
  await leaveSoloQueue(ctx.user.id);
  return NextResponse.json({ status: "idle", groupId: null });
}
