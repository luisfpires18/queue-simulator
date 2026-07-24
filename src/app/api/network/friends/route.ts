import { NextResponse } from "next/server";
import { listFriends } from "@/data/network";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const friends = await listFriends(ctx.user.id);
  return NextResponse.json({ friends });
}
