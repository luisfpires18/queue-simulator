import { NextResponse } from "next/server";
import { z } from "zod";
import { createChatGroup, listMyChatGroups } from "@/data/chatGroups";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  memberUserIds: z.array(z.string()).min(1).max(49),
});

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const groups = await listMyChatGroups(ctx.user.id);
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const result = await createChatGroup(ctx.user.id, body.data.name, body.data.memberUserIds);
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      empty_name: "Group needs a name.",
      no_members: "Pick at least one friend to add.",
      too_many_members: "That's too many members for one group.",
      not_friends: "You can only add your own friends to a group.",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 });
  }
  return NextResponse.json({ group: result.group });
}
