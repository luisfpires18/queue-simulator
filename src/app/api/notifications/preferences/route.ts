import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({ enabled: z.boolean(), settings: z.unknown().optional() });

// The settings blob is only ever written by this route, but a malformed row
// shouldn't 500 the whole preferences UI - fall back to defaults and log.
function parseSettings(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("notification preferences: malformed settings JSON", err);
    return {};
  }
}

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const pref = await prisma.notificationPreference.findUnique({ where: { userId: ctx.user.id } });
  return NextResponse.json({
    enabled: pref?.enabled ?? false,
    settings: pref ? parseSettings(pref.settings) : {},
  });
}

export async function PUT(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const body = await parseBody(req, schema, "Invalid body");
  if (!body.ok) return body.response;

  const existing = await prisma.notificationPreference.findUnique({ where: { userId: ctx.user.id } });
  const incoming = (body.data.settings as Record<string, unknown> | null | undefined) ?? {};
  const mergedSettings = { ...(existing ? parseSettings(existing.settings) : {}), ...incoming };

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: ctx.user.id },
    create: { userId: ctx.user.id, enabled: body.data.enabled, settings: JSON.stringify(mergedSettings) },
    update: { enabled: body.data.enabled, settings: JSON.stringify(mergedSettings) },
  });

  return NextResponse.json({ enabled: pref.enabled, settings: parseSettings(pref.settings) });
}
