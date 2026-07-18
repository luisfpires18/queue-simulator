// Pure — no DB, no network. A run is identified by Blizzard's own run id when
// one exists (it never does for the leaderboard endpoint today — see
// src/data/blizzardApp.ts), otherwise by a deterministic composite of
// dungeon + connected realm + completion time + the sorted set of member
// ids, so re-polling the same leaderboard entry always upserts the same row
// instead of inserting a duplicate.
export interface DedupeInput {
  blizzardRunId?: string | null;
  dungeonId: number;
  connectedRealmId: number;
  completedAt: number; // epoch ms
  memberBlizzardCharacterIds: number[];
}

export function computeDedupeKey(input: DedupeInput): string {
  if (input.blizzardRunId) return `id:${input.blizzardRunId}`;
  const members = [...input.memberBlizzardCharacterIds].sort((a, b) => a - b).join(",");
  return `composite:${input.dungeonId}:${input.connectedRealmId}:${input.completedAt}:${members}`;
}
