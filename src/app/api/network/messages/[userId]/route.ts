import { NextResponse } from "next/server";
import { z } from "zod";
import { listMessages, sendMessage } from "@/data/messages";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const sendSchema = z.object({ body: z.string().min(1).max(2000) });

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { userId } = await params;
  const before = new URL(req.url).searchParams.get("before") ?? undefined;
  const messages = await listMessages(ctx.user.id, userId, before);
  if (messages === null) return NextResponse.json({ error: "Not friends" }, { status: 403 });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { userId } = await params;
  const body = await parseBody(req, sendSchema);
  if (!body.ok) return body.response;

  const result = await sendMessage(ctx.user.id, userId, body.data.body);
  if (!result.ok) {
    const status = result.reason === "not_friends" ? 403 : 400;
    const error = result.reason === "not_friends" ? "Not friends" : "Message can't be empty";
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ message: result.message });
}
