// Pure Solo Queue matching logic. No I/O, no Prisma - mirrors analyze.ts /
// rating.ts. Scores how well an open Group fits a queued player so
// runSoloQueueMatch (src/data/source.ts) can pick the best candidate to
// propose the player to. M+ only - see README "Solo Queue" scope.

import { analyzeGroup, type Member } from "./analyze";

export interface QueueGroupSlot {
  role: string;
  prefs: string[]; // ordered acceptable specIds, empty = any spec for the role
}

export interface QueueGroupMember {
  specId: string | null;
  rating: number | null;
}

export interface QueueCandidateGroup {
  id: string;
  kind: string; // "mplus" | "raid"
  status: string; // "forming" | "delisted"
  reqRating: number | null;
  keyLevel: number | null;
  dungeonId: string | null;
  slots: QueueGroupSlot[];
  members: QueueGroupMember[];
}

export interface QueueEntry {
  role: string;
  specId: string;
  // Optional match filters, set from the board's filter sidebar at join time
  // (see BoardClient/SoloQueueClient) - "what am I applying for". Null/empty
  // means no restriction on that dimension.
  minKeyLevel?: number | null;
  maxKeyLevel?: number | null;
  dungeonIds?: string[];
}

/** Null = this group can't take the entry at all (wrong kind, not forming, no
 * open slot for the role/spec, or below the group's rating requirement).
 * Otherwise a fit score - higher is better - combining comp-archetype fit
 * (does adding this spec push the group toward a recognized comp) with how
 * close to full the group would end up, so Solo Queue favors groups it can
 * actually complete over ones that just happen to have a slot open. */
export function scoreGroupForQueueEntry(
  group: QueueCandidateGroup,
  entry: QueueEntry,
  entryScore: number | null
): number | null {
  if (group.kind !== "mplus") return null;
  if (group.status !== "forming") return null;

  if (entry.minKeyLevel != null && (group.keyLevel == null || group.keyLevel < entry.minKeyLevel)) return null;
  if (entry.maxKeyLevel != null && (group.keyLevel == null || group.keyLevel > entry.maxKeyLevel)) return null;
  if (entry.dungeonIds && entry.dungeonIds.length > 0 && (group.dungeonId == null || !entry.dungeonIds.includes(group.dungeonId))) return null;

  const slot = group.slots.find(
    (s) => s.role === entry.role && (s.prefs.length === 0 || s.prefs.includes(entry.specId))
  );
  if (!slot) return null;

  if (group.reqRating != null && (entryScore == null || entryScore < group.reqRating)) return null;

  const currentMembers: Member[] = group.members
    .filter((m): m is QueueGroupMember & { specId: string } => Boolean(m.specId))
    .map((m) => ({ specId: m.specId, rating: m.rating ?? undefined }));
  const withEntry = analyzeGroup([...currentMembers, { specId: entry.specId, rating: entryScore ?? undefined }]);

  // A slot with a specific spec preference (not "any spec for this role") is
  // a stronger signal the group actually wants this - worth more than
  // archetype-confidence noise.
  const specificityBonus = slot.prefs.length > 0 ? 25 : 0;
  const nearCompleteBonus = withEntry.size * 5; // prefer groups closer to full

  return withEntry.archetype.confidence + specificityBonus + nearCompleteBonus;
}

/** Highest-scoring viable group for this entry, or null if none can take it. */
export function pickBestGroup<T extends QueueCandidateGroup>(
  groups: T[],
  entry: QueueEntry,
  entryScore: number | null
): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const group of groups) {
    const score = scoreGroupForQueueEntry(group, entry, entryScore);
    if (score != null && score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  return best;
}
