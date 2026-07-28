// The two-sided decline history. Rows are written by declineApplication /
// declineTeamApplication and only ever read back by their own two parties -
// nothing here is exposed on a public profile.
import { prisma } from "@/lib/prisma";
import type { DeclineRecordDTO, LastDeclineDTO } from "./dto";
import { mergeCounts } from "./counts";
import { getDisplayIdentities } from "./network";

export interface DeclineRecordInput {
  applicantUserId: string;
  declinedByUserId: string;
  listingKind: string; // "mplus" | "raid" | "team"
  listingTitle: string;
  listingId: string;
  reasonId: string;
  reasonLabel: string;
  note?: string | null;
  characterName: string;
  characterRealm: string;
  classId: string;
  role: string;
  specId: string;
}

/** Prisma create args, so callers can fold this into their own transaction
 * rather than writing the record in a second, separately-failing step. */
export function declineRecordData(input: DeclineRecordInput) {
  return { ...input, note: input.note?.trim() || null };
}

/**
 * The applicant's most recent decline for each of the given listings, in one
 * query - so a card can show *why* it says "Declined" without a per-card
 * round trip.
 *
 * Keyed by listingId rather than by application id because the application
 * row doesn't survive: a team re-apply upserts it, and a group re-apply
 * inserts a new one. The listing is the stable thing the applicant is
 * looking at.
 */
export async function getLastDeclinesByListing(
  applicantUserId: string,
  listingIds: string[]
): Promise<Record<string, LastDeclineDTO>> {
  const out: Record<string, LastDeclineDTO> = {};
  if (listingIds.length === 0) return out;

  const rows = await prisma.declineRecord.findMany({
    where: { applicantUserId, listingId: { in: listingIds } },
    orderBy: { createdAt: "desc" },
    select: { listingId: true, reasonLabel: true, note: true, createdAt: true },
  });
  // Newest first, so the first row seen for a listing is the latest one.
  for (const r of rows) {
    if (out[r.listingId]) continue;
    out[r.listingId] = { reasonLabel: r.reasonLabel, note: r.note, createdAt: r.createdAt.toISOString() };
  }
  return out;
}

/**
 * How many times this user has been declined by each of the given listings.
 *
 * Teams need this because TeamApplication is upserted on re-apply - a
 * declined row is overwritten, so unlike groups (see
 * countDeclinedApplications) there's nothing left to count. These records
 * accumulate, which makes them the durable attempt counter.
 */
export async function countDeclinesByListing(
  applicantUserId: string,
  listingKind: string,
  listingIds: string[]
): Promise<Record<string, number>> {
  if (listingIds.length === 0) return {};
  const rows = await prisma.declineRecord.groupBy({
    by: ["listingId"],
    where: { applicantUserId, listingKind, listingId: { in: listingIds } },
    _count: { _all: true },
  });
  return mergeCounts(listingIds, rows.map((r) => ({ id: r.listingId, count: r._count._all })));
}

export type DeclineSide = "received" | "given";

/**
 * One page of a user's decline history. `side` picks whose column to filter
 * on, which is also what keeps this private: a caller can only ever ask for
 * their own id.
 */
export async function listDeclineRecords(
  userId: string,
  side: DeclineSide,
  page = 1,
  pageSize = 10
): Promise<{ records: DeclineRecordDTO[]; total: number }> {
  const where = side === "received" ? { applicantUserId: userId } : { declinedByUserId: userId };
  const [total, rows] = await Promise.all([
    prisma.declineRecord.count({ where }),
    prisma.declineRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // The other party, batched - one lookup for the whole page.
  const counterpartyIds = rows.map((r) => (side === "received" ? r.declinedByUserId : r.applicantUserId));
  const identities = await getDisplayIdentities(counterpartyIds);

  const records = rows.map((r) => ({
    id: r.id,
    listingKind: r.listingKind,
    listingTitle: r.listingTitle,
    listingId: r.listingId,
    reasonLabel: r.reasonLabel,
    note: r.note,
    characterName: r.characterName,
    characterRealm: r.characterRealm,
    classId: r.classId,
    role: r.role,
    specId: r.specId,
    createdAt: r.createdAt.toISOString(),
    counterparty: identities.get(side === "received" ? r.declinedByUserId : r.applicantUserId)!,
  }));

  return { records, total };
}
