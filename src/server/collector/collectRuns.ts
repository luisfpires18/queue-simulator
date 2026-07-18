// Polls Blizzard's official Mythic+ leaderboard for every realm our own
// tracked characters are on (plus any COLLECTOR_EXTRA_REALMS override), each
// of the season's 8 dungeons, for the current period — and persists every
// discovered run via src/data/runs.ts. See the plan doc for why this exists
// instead of relying on raider.io/Blizzard's per-character profile fetch at
// request time: those only ever surface a top-N subset, not full history.
import { prisma } from "@/lib/prisma";
import { DUNGEONS } from "@/game/season";
import { SPEC_ID_TO_SPEC_ID } from "@/game/blizzardMap";
import { specById } from "@/game/classes";
import {
  fetchCurrentPeriodId,
  fetchCurrentSeasonId,
  resolveConnectedRealmId,
  fetchDungeonLeaderboard,
} from "@/data/blizzardApp";
import { computeDedupeKey } from "./dedupe";
import { upsertRun } from "@/data/runs";

interface PollTarget {
  region: string;
  realmSlug: string;
}

async function getPollTargets(): Promise<PollTarget[]> {
  const rows = await prisma.character.findMany({
    distinct: ["region", "realmSlug"],
    select: { region: true, realmSlug: true },
  });
  const targets = new Map<string, PollTarget>();
  for (const r of rows) targets.set(`${r.region}|${r.realmSlug}`, { region: r.region, realmSlug: r.realmSlug });

  // Lets you poll a realm before any character on it has been synced yet —
  // e.g. `COLLECTOR_EXTRA_REALMS="eu:draenor,us:illidan"`.
  const extra = process.env.COLLECTOR_EXTRA_REALMS;
  if (extra) {
    for (const part of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [region, realmSlug] = part.split(":");
      if (region && realmSlug) targets.set(`${region}|${realmSlug}`, { region, realmSlug });
    }
  }
  return [...targets.values()];
}

export interface CollectCounts {
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
}

export async function collectRuns(): Promise<CollectCounts> {
  const totals: CollectCounts = { fetched: 0, inserted: 0, updated: 0, failed: 0 };
  const targets = await getPollTargets();
  if (targets.length === 0) {
    console.log("[collectRuns] no realms to poll (sync a character or set COLLECTOR_EXTRA_REALMS)");
    return totals;
  }

  // Built ONCE, across every tracked character regardless of which realm is
  // currently being polled — keyed by the MEMBER's own realm, not the target
  // realm driving this iteration of the loop. A run's roster can include
  // cross-realm party members, and the same underlying run can resurface
  // while polling a different (but connected) target realm; scoping this
  // lookup to "only match if the member's realm equals the current loop's
  // target realm" previously meant a later pass with a non-matching target
  // would recompute characterId as null and clobber an earlier correct match
  // via the upsert's update clause. Matching by the member's own identity,
  // independent of loop position, fixes that at the root.
  const allCharacters = await prisma.character.findMany({ select: { id: true, name: true, realmSlug: true, region: true } });
  const ownIdByKey = new Map(
    allCharacters.map((c) => [`${c.region}|${c.realmSlug}|${c.name.toLowerCase()}`, c.id])
  );

  const periodByRegion = new Map<string, number>();
  const seasonByRegion = new Map<string, number | null>();

  for (const { region, realmSlug } of targets) {
    let periodId = periodByRegion.get(region);
    let seasonId = seasonByRegion.get(region) ?? null;
    if (periodId == null) {
      try {
        periodId = await fetchCurrentPeriodId(region);
        periodByRegion.set(region, periodId);
        seasonId = await fetchCurrentSeasonId(region);
        seasonByRegion.set(region, seasonId);
      } catch (err) {
        console.error(`[collectRuns] failed to fetch current period/season for region=${region}:`, err instanceof Error ? err.message : err);
        totals.failed += DUNGEONS.length;
        continue;
      }
    }

    let connectedRealmId: number;
    try {
      connectedRealmId = await resolveConnectedRealmId(region, realmSlug);
    } catch (err) {
      console.error(`[collectRuns] failed to resolve connected realm for ${realmSlug} (${region}):`, err instanceof Error ? err.message : err);
      totals.failed += DUNGEONS.length;
      continue;
    }

    for (const dungeon of DUNGEONS) {
      try {
        const board = await fetchDungeonLeaderboard(region, connectedRealmId, dungeon.blizzardDungeonId, periodId);
        const runs = board.leading_groups ?? [];
        totals.fetched += runs.length;
        if (runs.length === 500) {
          console.warn(
            `[collectRuns] realm=${realmSlug} dungeon=${dungeon.id} period=${periodId} returned exactly 500 runs — leaderboard may be truncated`
          );
        }

        for (const run of runs) {
          try {
            const dedupeKey = computeDedupeKey({
              dungeonId: dungeon.blizzardDungeonId,
              connectedRealmId,
              completedAt: run.completed_timestamp,
              memberBlizzardCharacterIds: run.members.map((m) => m.profile.id),
            });

            const members = run.members.map((m) => {
              const ourSpecId = SPEC_ID_TO_SPEC_ID[m.specialization.id];
              const role = ourSpecId ? specById(ourSpecId)?.role ?? null : null;
              const characterId = ownIdByKey.get(`${region}|${m.profile.realm.slug}|${m.profile.name.toLowerCase()}`) ?? null;
              return {
                characterId,
                blizzardCharacterId: m.profile.id,
                name: m.profile.name,
                realmSlug: m.profile.realm.slug,
                region,
                specId: m.specialization.id,
                role,
              };
            });

            const result = await upsertRun({
              dedupeKey,
              seasonId,
              periodId,
              connectedRealmId,
              dungeonId: dungeon.blizzardDungeonId,
              keyLevel: run.keystone_level,
              score: run.mythic_rating?.rating ?? null,
              durationMs: run.duration,
              completedAt: new Date(run.completed_timestamp),
              members,
            });
            if (result === "inserted") totals.inserted++;
            else totals.updated++;
          } catch (err) {
            totals.failed++;
            console.error(`[collectRuns] failed to persist a run (realm=${realmSlug}, dungeon=${dungeon.id}):`, err instanceof Error ? err.message : err);
          }
        }
      } catch (err) {
        totals.failed++;
        console.error(`[collectRuns] failed to fetch leaderboard realm=${realmSlug} dungeon=${dungeon.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(
    `[collectRuns] done — fetched=${totals.fetched} inserted=${totals.inserted} updated=${totals.updated} failed=${totals.failed}`
  );
  return totals;
}
