import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/game/countries";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

// `country` is validated separately below so it keeps its own error message.
const schema = z.object({ showBattletag: z.boolean(), country: z.unknown().optional() });

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  return NextResponse.json({ showBattletag: ctx.user.showBattletag, country: ctx.user.country });
}

export async function PUT(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, schema, "Invalid body");
  if (!body.ok) return body.response;

  const country = body.data.country;
  if (country != null && (typeof country !== "string" || !COUNTRIES.some((c) => c.code === country))) {
    return NextResponse.json({ error: "Invalid country" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: ctx.user.id },
    data: { showBattletag: body.data.showBattletag, country: (country as string | undefined) ?? null },
  });

  return NextResponse.json({ showBattletag: updated.showBattletag, country: updated.country });
}
