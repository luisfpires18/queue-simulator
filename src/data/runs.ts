// Permanent Mythic+ run history — collected from Blizzard's official
// leaderboard API (src/server/collector), stored via the Run/RunMember
// models. Separate from src/data/source.ts (the user-driven app model) since
// this is reference data the collector writes and any character view reads,
// not something a user edits directly.
import { prisma } from "@/lib/prisma";

export interface RunMemberInput {
  characterId: string | null;
  blizzardCharacterId: number;
  name: string;
  realmSlug: string;
  region: string;
  specId: number;
  role: string | null;
}

export interface UpsertRunInput {
  dedupeKey: string;
  blizzardRunId?: string | null;
  seasonId: number | null;
  periodId: number;
  connectedRealmId: number;
  dungeonId: number;
  keyLevel: number;
  score: number | null;
  durationMs: number;
  completedAt: Date;
  members: RunMemberInput[];
}

/** Upserts one run (keyed on dedupeKey) and all its members. Returns whether
 * this run already existed (re-polling the same leaderboard entry updates it
 * in place) or was newly discovered. */
export async function upsertRun(input: UpsertRunInput): Promise<"inserted" | "updated"> {
  const existing = await prisma.run.findUnique({ where: { dedupeKey: input.dedupeKey } });

  const run = await prisma.run.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      dedupeKey: input.dedupeKey,
      blizzardRunId: input.blizzardRunId ?? null,
      seasonId: input.seasonId,
      periodId: input.periodId,
      connectedRealmId: input.connectedRealmId,
      dungeonId: input.dungeonId,
      keyLevel: input.keyLevel,
      score: input.score,
      durationMs: input.durationMs,
      completedAt: input.completedAt,
    },
    update: {
      keyLevel: input.keyLevel,
      score: input.score,
      durationMs: input.durationMs,
      completedAt: input.completedAt,
    },
  });

  await prisma.$transaction(
    input.members.map((m) =>
      prisma.runMember.upsert({
        where: { runId_blizzardCharacterId: { runId: run.id, blizzardCharacterId: m.blizzardCharacterId } },
        create: {
          runId: run.id,
          characterId: m.characterId,
          blizzardCharacterId: m.blizzardCharacterId,
          name: m.name,
          realmSlug: m.realmSlug,
          region: m.region,
          specId: m.specId,
          role: m.role,
        },
        update: {
          // Never regress an already-matched character back to unmatched —
          // `undefined` tells Prisma to leave the existing value alone.
          characterId: m.characterId ?? undefined,
          name: m.name,
          realmSlug: m.realmSlug,
          region: m.region,
          specId: m.specId,
          role: m.role,
        },
      })
    )
  );

  return existing ? "updated" : "inserted";
}

export interface RunMemberRow {
  characterId: string | null;
  specId: number;
  dungeonId: number;
  keyLevel: number;
  score: number | null;
  completedAt: Date;
}

export interface BestRun {
  characterId: string;
  specId: number;
  dungeonId: number;
  keyLevel: number;
  score: number | null;
  completedAt: Date;
}

/** Best run per (characterId, specId, dungeonId) — ranked by score, falling
 * back to key level when score is missing. Pure — no DB, directly testable. */
export function selectBestRuns(rows: RunMemberRow[]): BestRun[] {
  const best = new Map<string, BestRun>();
  for (const row of rows) {
    if (!row.characterId) continue;
    const key = `${row.characterId}|${row.specId}|${row.dungeonId}`;
    const rank = row.score ?? row.keyLevel;
    const existing = best.get(key);
    const existingRank = existing ? existing.score ?? existing.keyLevel : -Infinity;
    if (!existing || rank > existingRank) best.set(key, { ...row, characterId: row.characterId });
  }
  return [...best.values()];
}

export async function getBestRunsForCharacter(characterId: string): Promise<BestRun[]> {
  const rows = await prisma.runMember.findMany({
    where: { characterId },
    include: { run: true },
  });
  return selectBestRuns(
    rows.map((r) => ({
      characterId: r.characterId,
      specId: r.specId,
      dungeonId: r.run.dungeonId,
      keyLevel: r.run.keyLevel,
      score: r.run.score,
      completedAt: r.run.completedAt,
    }))
  );
}
