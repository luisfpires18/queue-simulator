import { NextResponse } from "next/server";
import { fetchDungeonZones } from "@/server/wcl/raidZones.js";
import { fetchOverview } from "@/server/wcl/api.js";
import { analyzeApplicant } from "@/server/analysis/applicant.js";
import { fetchRaiderIoRating } from "@/data/raiderio";
import { DUNGEONS } from "@/game/season";
import { specById } from "@/game/classes";
import { personalDefensivesForClass } from "@/game/personalDefensives";
import { providedExternalsForSpec } from "@/game/providedExternals";
import { interruptForSpec } from "@/game/interrupts";
import { canDispel } from "@/game/dispels";
import { avoidableFor, AVOIDABLE_DATASET_VERSION } from "@/game/avoidable";
import { requireUser, wclSpecParams, wantsRefresh, errorResponse, ApiError } from "@/server/wclHelpers";
import { assertFeature } from "@/server/features";

export const dynamic = "force-dynamic";

// BETA — full applicant combat scan for ANY character (region/realm/name), no
// ownership. Requires a signed-in user only as a light gate on the shared WCL
// token budget; deliberately skips loadOwnedCharacter so a recruiter can scan an
// applicant that isn't on their account.
//
//   ?region= &realm= &name=   required (realm = WCL/raider.io realm slug)
//   ?specId=                  optional (default: raider.io active spec)
//   ?target=                  optional key level being applied for (fit gate)
//   ?refresh=1                bypass disk cache
export async function GET(req: Request) {
  // Alpha gate. Layouts cover the pages under this feature, but a route
  // handler is not a child of any layout, so it asserts for itself.
  const gate = await assertFeature("analyses");
  if (gate) return gate;

  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const realm = searchParams.get("realm");
    const name = searchParams.get("name");
    if (!region || !realm || !name) {
      throw new ApiError("region, realm and name query params are all required", 400);
    }

    // Identity + rating from raider.io (works for any character, no auth).
    const rating = await fetchRaiderIoRating(region, realm, name);
    if (!rating.classId) {
      throw new ApiError(`No raider.io record for ${name} (${realm}-${region}) — check spelling/realm slug`, 404);
    }
    const specId = searchParams.get("specId") ?? rating.activeSpecId;
    const { className, specName } = wclSpecParams(rating.classId, specId);

    // Current-season M+ zone — arbitrary chars have no stored wclZone, so
    // resolve it live. WCL also lists the NEXT season's zone before it's live,
    // so "newest id" is wrong; pick the zone whose encounters match season.ts's
    // S1 pool (falls back to newest if nothing matches).
    const zones = (await fetchDungeonZones({ refresh: wantsRefresh(searchParams) })) as {
      id: number; name: string; encounters?: { id: number; name: string }[];
    }[];
    if (!zones.length) throw new ApiError("Could not resolve the current Mythic+ zone from Warcraft Logs", 502);
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const seasonNames = new Set(DUNGEONS.map((d) => norm(d.name)));
    const ranked = zones
      .map((z) => ({ z, hits: (z.encounters ?? []).filter((e) => seasonNames.has(norm(e.name))).length }))
      .sort((a, b) => b.hits - a.hits || b.z.id - a.z.id);
    const zone = ranked[0].hits > 0 ? ranked[0].z : zones[0];

    const serverRegion = region.toUpperCase();
    const refresh = wantsRefresh(searchParams);

    // One overview pass gives the live WCL encounterIDs for this character's
    // dungeons (the id space season.ts doesn't carry). Cheap + cached; the
    // per-dungeon encounter fetches it does are reused warm by the scan below.
    const overview = (await fetchOverview({
      name,
      serverSlug: realm,
      serverRegion,
      zoneID: zone.id,
      specName,
      refresh,
    } as never)) as { dungeons: { encounterID: number | null; name: string }[] };
    // Map each WCL dungeon to its season.ts id (by normalised name) so the
    // avoidable-damage dataset for that dungeon can be attached, filtered to the
    // applicant's role/spec.
    const role = specById(specId ?? "")?.role ?? "DPS";
    const seasonByName = new Map(DUNGEONS.map((dd) => [norm(dd.name), dd.id]));
    const dungeons = overview.dungeons
      .filter((d) => d.encounterID)
      .map((d) => {
        const seasonId = seasonByName.get(norm(d.name)) ?? null;
        return {
          encounterID: d.encounterID,
          name: d.name,
          seasonId,
          avoidable: avoidableFor(seasonId, role, specId).map((a) => ({
            spellId: a.spellId, name: a.name, category: a.category, severity: a.severity,
          })),
        };
      });

    const targetRaw = searchParams.get("target");
    const targetLevel = targetRaw ? Number(targetRaw) : null;

    // analyzeApplicant is plain JS; tsc infers its param types from the null/[]
    // defaults, so the real args (strings/arrays) need the same `as never` cast
    // the fetchOverview call above uses.
    const result = await analyzeApplicant({
      name,
      serverSlug: realm,
      serverRegion,
      zoneID: zone.id,
      className,
      specName,
      dungeons,
      personalDefensives: personalDefensivesForClass(rating.classId),
      providedExternals: providedExternalsForSpec(specId),
      interruptSpellId: interruptForSpec(specId)?.spellId ?? null,
      canDispel: canDispel(specId),
      targetLevel: Number.isFinite(targetLevel) ? targetLevel : null,
      rating: rating.overallRating,
      refresh,
    } as never);

    return NextResponse.json({
      ...result,
      meta: {
        region: serverRegion,
        realm,
        name,
        classId: rating.classId,
        specId,
        rating: rating.overallRating,
        ilvl: rating.ilvl,
        interrupt: interruptForSpec(specId),
        avoidableVersion: AVOIDABLE_DATASET_VERSION,
        zone,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
