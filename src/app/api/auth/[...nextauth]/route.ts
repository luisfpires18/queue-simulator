import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { checkRateLimit } from "@/server/rateLimit";

export const { GET } = handlers;

// Backstops the local sign-in/callback endpoints (both the real Battle.net
// OAuth flow and the dev-only Credentials login) against being hammered -
// Battle.net's own OAuth server already rate-limits itself, this just caps
// how often this app's own /api/auth/* POST routes can be hit. Keyed by IP
// since there's no session yet at this point.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit("auth", ip, 20, 60_000)) {
    return NextResponse.json({ error: "Too many attempts - try again in a moment." }, { status: 429 });
  }
  return handlers.POST(req);
}
