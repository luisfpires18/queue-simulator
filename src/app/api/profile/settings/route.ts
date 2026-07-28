import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/game/countries";
import { isBannerClassId } from "@/game/banners";
import { normalizeDiscordHandle, normalizeTwitchHandle } from "@/lib/social";
import { getSessionUser, notAuthenticated, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

// `country` is validated separately below so it keeps its own error message.
const schema = z.object({
  showBattletag: z.boolean(),
  country: z.unknown().optional(),
  discord: z.string().max(100).nullish(),
  twitch: z.string().max(200).nullish(),
  aboutMe: z.string().max(1000).nullish(),
  // The image itself is uploaded through /api/profile/banner; this only ever
  // carries the class-banner choice, so "upload" is not accepted here.
  bannerClassId: z.string().nullish(),
  lftStatus: z.enum(["none", "lft"]).optional(),
});

/** Never store an all-whitespace About me - it would render an empty block. */
function normalizeAboutMe(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  return NextResponse.json({
    showBattletag: ctx.user.showBattletag,
    country: ctx.user.country,
    discord: ctx.user.discord,
    twitch: ctx.user.twitch,
    aboutMe: ctx.user.aboutMe,
    bannerType: ctx.user.bannerType,
    bannerClassId: ctx.user.bannerClassId,
    bannerImage: ctx.user.bannerImage,
    lftStatus: ctx.user.lftStatus,
  });
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

  const bannerClassId = body.data.bannerClassId ?? null;
  if (bannerClassId != null && !isBannerClassId(bannerClassId)) {
    return NextResponse.json({ error: "Invalid banner class" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: ctx.user.id },
    data: {
      showBattletag: body.data.showBattletag,
      country: (country as string | undefined) ?? null,
      discord: body.data.discord != null ? normalizeDiscordHandle(body.data.discord) : null,
      twitch: body.data.twitch != null ? normalizeTwitchHandle(body.data.twitch) : null,
      aboutMe: normalizeAboutMe(body.data.aboutMe),
      bannerClassId,
      ...(body.data.lftStatus ? { lftStatus: body.data.lftStatus } : {}),
    },
  });

  return NextResponse.json({
    showBattletag: updated.showBattletag,
    country: updated.country,
    discord: updated.discord,
    twitch: updated.twitch,
    aboutMe: updated.aboutMe,
    bannerType: updated.bannerType,
    bannerClassId: updated.bannerClassId,
    bannerImage: updated.bannerImage,
    lftStatus: updated.lftStatus,
  });
}
