import { NextResponse } from "next/server";
import { getCharacterRatingSummary } from "@/data/source";

export const dynamic = "force-dynamic";

// Public (no auth/ownership gate) — a character actively listing a key or
// applying to one is already implicitly visible, same privacy bar as the
// public profile page. 404s only if the character itself doesn't exist.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await getCharacterRatingSummary(id);
  if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(summary);
}
