import { NextResponse } from "next/server";
import { getFriendshipStatus } from "@/data/network";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

// Backs the public-profile Add Friend button's state.
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const { userId } = await params;
  const status = await getFriendshipStatus(ctx.user.id, userId);
  return NextResponse.json({ status });
}
