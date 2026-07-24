// Friend request + friend list lifecycle: send, accept, decline, cancel,
// unfriend. Models itself directly on src/data/applications.ts — status is a
// plain string ("pending" | "accepted" | "declined"), no DB enum (SQLite has
// none, same as everywhere else in this schema). An accepted FriendRequest
// row IS the friendship; there's no separate Friendship table.
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/server/notifications/dispatch";
import { networkBroadcaster } from "@/server/network/broadcaster";
import type { DisplayIdentityDTO, FriendDTO, FriendRequestDTO, FriendshipStatus, SendFriendRequestResult } from "./dto";
import { friendDTO, friendRequestDTO } from "./mappers";

interface DisplayCandidate {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  faction: string;
  isMain: boolean;
  bucket: string;
  sortOrder: number;
  level: number;
}

/** Picks the character that represents a user on a friend card: their main
 * (isMain) if they have one, else the first by the same ordering used for the
 * roster board (sortOrder, then level desc, then name). Hidden characters are
 * excluded — same privacy bar as the public profile page. Pure so it can be
 * unit-tested without a database. */
export function pickDisplayCharacter<T extends DisplayCandidate>(characters: T[]): T | null {
  const visible = characters.filter((c) => c.bucket !== "hidden");
  if (visible.length === 0) return null;
  const sorted = [...visible].sort(
    (a, b) => a.sortOrder - b.sortOrder || b.level - a.level || a.name.localeCompare(b.name)
  );
  return sorted.find((c) => c.isMain) ?? sorted[0];
}

/** A user's "who they are" for a friend card — see DisplayIdentityDTO. Null
 * fields mean the user has no visible characters synced yet. */
export async function getDisplayIdentity(userId: string): Promise<DisplayIdentityDTO> {
  const [user, characters] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { battletag: true, showBattletag: true } }),
    prisma.character.findMany({
      where: { userId },
      select: {
        name: true, realm: true, realmSlug: true, region: true, classId: true, faction: true,
        isMain: true, bucket: true, sortOrder: true, level: true,
      },
    }),
  ]);
  const chosen = pickDisplayCharacter(characters);
  return {
    battletag: user?.showBattletag ? user.battletag : null,
    characterName: chosen?.name ?? null,
    characterRealm: chosen?.realm ?? null,
    characterRealmSlug: chosen?.realmSlug ?? null,
    region: chosen?.region ?? null,
    classId: chosen?.classId ?? null,
    level: chosen?.level ?? null,
    faction: chosen?.faction ?? null,
  };
}

/** Derives the viewer's relationship to another user from whatever
 * FriendRequest rows exist between them (any direction). Only the most
 * recent non-declined row matters — a pile of past declines doesn't block a
 * fresh request, same as Application. Pure so it can be unit-tested. */
export function computeFriendshipStatus(
  rows: { requesterUserId: string; addresseeUserId: string; status: string; createdAt: Date }[],
  viewerId: string,
  otherId: string
): FriendshipStatus {
  const active = rows
    .filter((r) => r.status !== "declined")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!active) return "none";
  if (active.status === "accepted") return "friends";
  return active.requesterUserId === viewerId ? "pending_outgoing" : "pending_incoming";
}

async function rowsBetween(userId: string, otherUserId: string) {
  return prisma.friendRequest.findMany({
    where: {
      OR: [
        { requesterUserId: userId, addresseeUserId: otherUserId },
        { requesterUserId: otherUserId, addresseeUserId: userId },
      ],
    },
  });
}

/** Backs the public-profile Add Friend button's state. */
export async function getFriendshipStatus(userId: string, otherUserId: string): Promise<FriendshipStatus> {
  if (userId === otherUserId) return "friends"; // a profile never shows "Add Friend" to its own owner
  const rows = await rowsBetween(userId, otherUserId);
  return computeFriendshipStatus(rows, userId, otherUserId);
}

export async function areFriends(userId: string, otherUserId: string): Promise<boolean> {
  return (await getFriendshipStatus(userId, otherUserId)) === "friends";
}

/** Sends a friend request, refusing self-friending, an existing friendship,
 * or an already-pending request (either direction) — the TOCTOU window
 * between the check and the insert is closed by the transaction, same
 * pattern as createApplication. */
export async function sendFriendRequest(requesterUserId: string, addresseeUserId: string): Promise<SendFriendRequestResult> {
  if (requesterUserId === addresseeUserId) return { ok: false, reason: "self" };

  const txResult = await prisma.$transaction(async (tx) => {
    const rows = await tx.friendRequest.findMany({
      where: {
        OR: [
          { requesterUserId, addresseeUserId },
          { requesterUserId: addresseeUserId, addresseeUserId: requesterUserId },
        ],
      },
    });
    const status = computeFriendshipStatus(rows, requesterUserId, addresseeUserId);
    if (status === "friends") return { ok: false as const, reason: "already_friends" as const };
    if (status !== "none") return { ok: false as const, reason: "already_pending" as const };
    const row = await tx.friendRequest.create({ data: { requesterUserId, addresseeUserId, status: "pending" } });
    return { ok: true as const, row };
  });
  if (!txResult.ok) return txResult;

  const [requester, addressee] = await Promise.all([getDisplayIdentity(requesterUserId), getDisplayIdentity(addresseeUserId)]);
  const request = friendRequestDTO(txResult.row, requester, addressee);

  notifyUser(addresseeUserId, {
    title: "New friend request",
    body: `${requester.characterName ?? requester.battletag ?? "Someone"} wants to connect.`,
    url: "/network",
  }).catch((err) => console.error("notifyUser friend_request failed", err));
  networkBroadcaster.publish(addresseeUserId, { type: "friend_request", requestId: request.id });

  return { ok: true, request };
}

/** Accepts a pending request addressed to the caller. Returns false if it
 * doesn't exist, isn't pending, or isn't the caller's to accept. */
export async function acceptFriendRequest(requestId: string, addresseeUserId: string): Promise<boolean> {
  const row = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!row || row.status !== "pending" || row.addresseeUserId !== addresseeUserId) return false;

  await prisma.friendRequest.update({ where: { id: requestId }, data: { status: "accepted" } });

  const addresseeIdentity = await getDisplayIdentity(addresseeUserId);
  notifyUser(row.requesterUserId, {
    title: "Friend request accepted",
    body: `${addresseeIdentity.characterName ?? addresseeIdentity.battletag ?? "They"} accepted your friend request.`,
    url: "/network",
  }).catch((err) => console.error("notifyUser friend_accepted failed", err));

  networkBroadcaster.publish(row.requesterUserId, { type: "friend_resolved", requestId, status: "accepted" });
  networkBroadcaster.publish(addresseeUserId, { type: "friend_resolved", requestId, status: "accepted" });
  return true;
}

/** Declines a pending request addressed to the caller. Stays silent (no push)
 * — same rationale as queue-sourced Application declines: nothing actionable
 * for the sender, and an unsolicited "you were declined" push is unkind for a
 * social feature. The sender's own UI still refreshes live via SSE. */
export async function declineFriendRequest(requestId: string, addresseeUserId: string): Promise<boolean> {
  const row = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!row || row.status !== "pending" || row.addresseeUserId !== addresseeUserId) return false;

  await prisma.friendRequest.update({ where: { id: requestId }, data: { status: "declined" } });
  networkBroadcaster.publish(row.requesterUserId, { type: "friend_resolved", requestId, status: "declined" });
  return true;
}

/** Cancels the caller's own still-pending outgoing request. */
export async function cancelFriendRequest(requestId: string, requesterUserId: string): Promise<boolean> {
  const row = await prisma.friendRequest.findFirst({ where: { id: requestId, requesterUserId, status: "pending" } });
  if (!row) return false;
  await prisma.friendRequest.delete({ where: { id: requestId } });
  networkBroadcaster.publish(row.addresseeUserId, { type: "friend_resolved", requestId, status: "cancelled" });
  return true;
}

/** Ends an existing friendship (either side can call this). Message history
 * is kept — same as Application declines piling up as history. */
export async function removeFriend(userId: string, otherUserId: string): Promise<boolean> {
  const row = await prisma.friendRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterUserId: userId, addresseeUserId: otherUserId },
        { requesterUserId: otherUserId, addresseeUserId: userId },
      ],
    },
  });
  if (!row) return false;
  await prisma.friendRequest.delete({ where: { id: row.id } });
  networkBroadcaster.publish(otherUserId, { type: "friend_removed", userId });
  return true;
}

async function toFriendRequestDTOs(rows: { id: string; requesterUserId: string; addresseeUserId: string; status: string; createdAt: Date }[]): Promise<FriendRequestDTO[]> {
  return Promise.all(
    rows.map(async (r) => {
      const [requester, addressee] = await Promise.all([getDisplayIdentity(r.requesterUserId), getDisplayIdentity(r.addresseeUserId)]);
      return friendRequestDTO(r, requester, addressee);
    })
  );
}

export async function listIncomingRequests(userId: string): Promise<FriendRequestDTO[]> {
  const rows = await prisma.friendRequest.findMany({ where: { addresseeUserId: userId, status: "pending" }, orderBy: { createdAt: "desc" } });
  return toFriendRequestDTOs(rows);
}

export async function listOutgoingRequests(userId: string): Promise<FriendRequestDTO[]> {
  const rows = await prisma.friendRequest.findMany({ where: { requesterUserId: userId, status: "pending" }, orderBy: { createdAt: "desc" } });
  return toFriendRequestDTOs(rows);
}

/** The caller's friends, each with an unread-message count from that friend. */
export async function listFriends(userId: string): Promise<FriendDTO[]> {
  const rows = await prisma.friendRequest.findMany({
    where: { status: "accepted", OR: [{ requesterUserId: userId }, { addresseeUserId: userId }] },
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.requesterUserId === userId ? r.addresseeUserId : r.requesterUserId));
  const unread = await prisma.message.groupBy({
    by: ["senderId"],
    where: { recipientId: userId, senderId: { in: otherIds }, readAt: null },
    _count: { _all: true },
  });
  const unreadBySender = new Map(unread.map((u) => [u.senderId, u._count._all]));

  return Promise.all(
    rows.map(async (r) => {
      const otherId = r.requesterUserId === userId ? r.addresseeUserId : r.requesterUserId;
      const identity = await getDisplayIdentity(otherId);
      return friendDTO(
        { friendRequestId: r.id, userId: otherId, since: r.updatedAt },
        identity,
        unreadBySender.get(otherId) ?? 0,
        networkBroadcaster.isOnline(otherId)
      );
    })
  );
}

/** Just the other-side user ids of the caller's friends — for fanning out
 * presence transitions (see /api/stream/network) without the identity/unread
 * lookups listFriends does for the UI. */
export async function listFriendUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendRequest.findMany({
    where: { status: "accepted", OR: [{ requesterUserId: userId }, { addresseeUserId: userId }] },
    select: { requesterUserId: true, addresseeUserId: true },
  });
  return rows.map((r) => (r.requesterUserId === userId ? r.addresseeUserId : r.requesterUserId));
}

/** Incoming-pending request count, for the header badge. */
export async function getPendingIncomingCount(userId: string): Promise<number> {
  return prisma.friendRequest.count({ where: { addresseeUserId: userId, status: "pending" } });
}
