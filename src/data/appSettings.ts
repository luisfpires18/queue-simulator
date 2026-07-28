// Admin-settable app-wide string config (see AppSetting in schema.prisma).
// Currently just the current-season toggle, but the "id = the key" shape
// generalizes the same way FeatureFlag does for booleans.
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SEASON_ID } from "@/game/season";

const CURRENT_SEASON_KEY = "currentSeasonId";

/** Which season is "current" right now - defaults to DEFAULT_SEASON_ID until
 * an admin has ever touched the setting. React-cached per request - several
 * pages and AccountMenu all read this on the same render. */
export const getCurrentSeasonId = cache(async (): Promise<string> => {
  const row = await prisma.appSetting.findUnique({ where: { id: CURRENT_SEASON_KEY } });
  return row?.value ?? DEFAULT_SEASON_ID;
});

export async function setCurrentSeasonId(seasonId: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { id: CURRENT_SEASON_KEY },
    create: { id: CURRENT_SEASON_KEY, value: seasonId },
    update: { value: seasonId },
  });
}
