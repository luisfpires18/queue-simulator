// Solo Queue persistence + matcher glue.
//
// "Find me a group" for a player, instead of them browsing the board
// themselves. A queued player is automatically proposed — as an ordinary
// Application with source "queue" — to the best-fit forming M+ group's
// leader, reusing acceptApplication/declineApplication (see
// src/data/applications.ts) for the actual accept/decline handling. A
// decline never reaches the player; the entry just goes back to "queued"
// and gets retried against the next candidate on the next match pass (see
// runSoloQueueMatch, driven via the single-flight runner in
// src/server/soloQueue/matchRunner.ts by the shared SSE board tick, the
// 4s GET /api/solo-queue poll, and the retry right after a decline).
import { prisma } from "@/lib/prisma";
import { rankScoreFor } from "@/game/rating";
import { pickBestGroup, type QueueCandidateGroup } from "@/game/soloQueue";
import { startsConflict } from "@/game/scheduling";
import type { JoinSoloQueueInput, SoloQueueStatusDTO } from "./dto";
import { parseSlots } from "./mappers";
import { getActiveCommitments } from "./groups";

/** Starts (or restarts) this user's Solo Queue search. Any previous active
 * entry is cancelled first — a player can only be searching with one
 * character/role/spec at a time. */
export async function joinSoloQueue(userId: string, input: JoinSoloQueueInput): Promise<void> {
  // Cancel-old + create-new must be atomic so two rapid joins can't leave two
  // "queued" rows for the same user.
  const [, entry] = await prisma.$transaction([
    prisma.soloQueueEntry.updateMany({
      where: { userId, status: "queued" },
      data: { status: "cancelled" },
    }),
    prisma.soloQueueEntry.create({
      data: {
        userId, characterId: input.characterId, role: input.role, specId: input.specId, status: "queued",
        minKeyLevel: input.minKeyLevel ?? null,
        maxKeyLevel: input.maxKeyLevel ?? null,
        dungeonIds: JSON.stringify(input.dungeonIds ?? []),
      },
    }),
  ]);
  await matchOneQueueEntry(entry);
}

/** Cancels this user's active Solo Queue entry, if any, declining its
 * outstanding proposal (if it has one) so it doesn't linger in the leader's
 * Pending Requests list for a search the player gave up on. */
export async function leaveSoloQueue(userId: string): Promise<void> {
  const entry = await prisma.soloQueueEntry.findFirst({ where: { userId, status: "queued" } });
  if (!entry) return;
  if (entry.activeApplicationId) {
    const app = await prisma.application.findUnique({ where: { id: entry.activeApplicationId } });
    if (app && app.status === "pending") {
      await prisma.application.update({ where: { id: app.id }, data: { status: "declined" } });
    }
  }
  await prisma.soloQueueEntry.update({ where: { id: entry.id }, data: { status: "cancelled", activeApplicationId: null } });
}

/** The calling user's own Solo Queue state — never exposes proposal/decline
 * history, only whether they're searching or matched, by design. */
export async function getMySoloQueueStatus(userId: string): Promise<SoloQueueStatusDTO> {
  const entry = await prisma.soloQueueEntry.findFirst({
    where: { userId, status: { in: ["queued", "matched"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) return { status: "idle", groupId: null };
  if (entry.status === "matched") {
    const app = await prisma.application.findFirst({
      where: { applicantUserId: userId, characterId: entry.characterId, status: "accepted", source: "queue" },
      orderBy: { updatedAt: "desc" },
      include: { group: { select: { status: true } } },
    });
    // The leader can delist the key after accepting - self-heal back to
    // "idle" instead of leaving the player staring at a "See Key Listed"
    // link that goes nowhere (there's no run-completion event to key off,
    // so a delisted group is the closest signal that this match is over).
    if (app && app.group.status !== "delisted") {
      return { status: "matched", groupId: app.groupId };
    }
    await prisma.soloQueueEntry.update({ where: { id: entry.id }, data: { status: "cancelled" } });
    return { status: "idle", groupId: null };
  }
  return { status: "queued", groupId: null };
}

/** Proposes one queued entry (that has no outstanding proposal) to the
 * best-fit forming M+ group, if any. No-op if nothing viable is open right
 * now — the entry just stays "queued" for the next pass. */
async function matchOneQueueEntry(entry: {
  id: string; userId: string; characterId: string; role: string; specId: string; activeApplicationId: string | null;
  minKeyLevel?: number | null; maxKeyLevel?: number | null; dungeonIds?: string;
}): Promise<void> {
  if (entry.activeApplicationId) return;

  // Excludes groups this player has already been declined from (queue-
  // proposed or applied manually) - otherwise a leader who just declined
  // would keep getting the exact same suggestion back every match pass.
  const candidates = await prisma.group.findMany({
    where: {
      status: "forming", kind: "mplus",
      applications: { none: { applicantUserId: entry.userId, status: "declined" } },
    },
    include: { members: { include: { character: { select: { specId: true, rating: true } } } } },
  });

  // Never propose a group that would collide with something this player is
  // already committed to (see findSchedulingConflict) - acceptApplication
  // would just reject it anyway, and the leader shouldn't see a suggestion
  // that can't actually be accepted.
  const commitments = await getActiveCommitments(entry.userId);
  const nonConflicting = candidates.filter(
    (g) => !commitments.some((c) => startsConflict(c.startsAt, g.startsAt ? g.startsAt.toISOString() : null))
  );

  const groups: QueueCandidateGroup[] = nonConflicting.map((g) => ({
    id: g.id,
    kind: g.kind,
    status: g.status,
    reqRating: g.reqRating,
    keyLevel: g.keyLevel,
    dungeonId: g.dungeonId,
    slots: parseSlots(g.slots),
    members: g.members.map((m) => ({ specId: m.specId ?? m.character.specId, rating: m.character.rating })),
  }));

  const tracks = await prisma.characterSpecTrack.findMany({ where: { characterId: entry.characterId } });
  const { score } = tracks.length ? rankScoreFor(tracks, entry.specId) : { score: null };

  let dungeonIds: string[] = [];
  try {
    const parsed = JSON.parse(entry.dungeonIds ?? "[]");
    if (Array.isArray(parsed)) dungeonIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // malformed - treat as "any dungeon"
  }

  const best = pickBestGroup(
    groups,
    { role: entry.role, specId: entry.specId, minKeyLevel: entry.minKeyLevel, maxKeyLevel: entry.maxKeyLevel, dungeonIds },
    score
  );
  if (!best) return;

  const app = await prisma.application.create({
    data: {
      groupId: best.id, applicantUserId: entry.userId, characterId: entry.characterId,
      role: entry.role, specId: entry.specId, status: "pending", source: "queue",
    },
  });

  // Atomic claim: matchOneQueueEntry can run concurrently for the same entry
  // (the SSE tick and a decline-triggered retry can overlap) - the initial
  // `if (entry.activeApplicationId) return` above only guards against a
  // *stale read*, not a race between two calls that both read null before
  // either writes. Only the call whose conditional update actually matches a
  // row wins the claim; the loser's just-created Application never had a
  // chance to be seen by anyone, so it's deleted rather than "declined"
  // (which would wrongly exclude that group from future matches).
  const claimed = await prisma.soloQueueEntry.updateMany({
    where: { id: entry.id, activeApplicationId: null },
    data: { activeApplicationId: app.id },
  });
  if (claimed.count === 0) {
    await prisma.application.delete({ where: { id: app.id } });
  }
}

/** Advances every queued entry with no outstanding proposal one step. Cheap
 * to call often — pure DB reads/writes, no external I/O — so it piggybacks
 * on the existing SSE board tick instead of running its own interval.
 * Callers outside this module should go through runMatchPass
 * (src/server/soloQueue/matchRunner.ts), which single-flights it. */
export async function runSoloQueueMatch(): Promise<void> {
  const entries = await prisma.soloQueueEntry.findMany({ where: { status: "queued", activeApplicationId: null } });
  for (const entry of entries) {
    await matchOneQueueEntry(entry);
  }
}
