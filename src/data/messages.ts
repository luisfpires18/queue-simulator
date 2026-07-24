// 1:1 chat between friends. Every operation is gated on an accepted
// FriendRequest existing between the two users (see areFriends in
// src/data/network.ts) — there's no group/room concept, just a thread keyed
// by the pair of user ids.
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/server/notifications/dispatch";
import { networkBroadcaster } from "@/server/network/broadcaster";
import { areFriends, getDisplayIdentity } from "./network";
import type { MessageDTO } from "./dto";
import { messageDTO } from "./mappers";

const PAGE_SIZE = 30;

/** Message history between two users, newest page first internally but
 * returned oldest-first for straightforward rendering. Returns null if
 * they're not friends (caller should treat that as a 403, not an empty
 * thread — the two are meaningfully different states). */
export async function listMessages(userId: string, friendUserId: string, before?: string): Promise<MessageDTO[] | null> {
  if (!(await areFriends(userId, friendUserId))) return null;

  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, recipientId: friendUserId },
        { senderId: friendUserId, recipientId: userId },
      ],
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });
  return rows.reverse().map(messageDTO);
}

export type SendMessageResult = { ok: true; message: MessageDTO } | { ok: false; reason: "not_friends" | "empty" };

/** Sends a message; the friendship gate is re-checked here (not just at the
 * page-load gate) since a thread can stay open across an unfriend. */
export async function sendMessage(senderId: string, recipientId: string, body: string): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (!(await areFriends(senderId, recipientId))) return { ok: false, reason: "not_friends" };

  const row = await prisma.message.create({ data: { senderId, recipientId, body: trimmed } });
  const message = messageDTO(row);

  const senderIdentity = await getDisplayIdentity(senderId);
  notifyUser(recipientId, {
    title: senderIdentity.characterName ?? senderIdentity.battletag ?? "New message",
    body: trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed,
    url: `/network/${senderId}`,
  }).catch((err) => console.error("notifyUser message failed", err));

  networkBroadcaster.publish(recipientId, { type: "message", senderId, recipientId });
  networkBroadcaster.publish(senderId, { type: "message", senderId, recipientId }); // other open tabs of the sender's own account
  return { ok: true, message };
}

/** Marks every unread message from one friend as read. */
export async function markThreadRead(userId: string, friendUserId: string): Promise<void> {
  await prisma.message.updateMany({
    where: { senderId: friendUserId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}
