// Team Group messages — mirrors src/data/messages.ts's shape, gated on
// membership (isChatGroupMember) instead of 1:1 friendship.
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/server/notifications/dispatch";
import { networkBroadcaster } from "@/server/network/broadcaster";
import { getDisplayIdentity } from "./network";
import { isChatGroupMember } from "./chatGroups";
import type { ChatGroupMessageDTO } from "./dto";
import { chatGroupMessageDTO } from "./mappers";

const PAGE_SIZE = 30;

/** Message history for one group, oldest-first, gated on membership (null if
 * the caller isn't a member — a 404, not an empty thread). Each message
 * carries its sender's display identity inline (batched, one lookup per
 * unique sender in the page) since group bubbles need a name, unlike DMs
 * where "not me" is unambiguous. */
export async function listChatGroupMessages(chatGroupId: string, userId: string, before?: string): Promise<ChatGroupMessageDTO[] | null> {
  if (!(await isChatGroupMember(chatGroupId, userId))) return null;

  const rows = await prisma.chatGroupMessage.findMany({
    where: { chatGroupId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });
  const ascending = rows.reverse();

  const uniqueSenderIds = [...new Set(ascending.map((m) => m.senderId))];
  const identities = new Map(await Promise.all(uniqueSenderIds.map(async (id) => [id, await getDisplayIdentity(id)] as const)));

  return ascending.map((m) => chatGroupMessageDTO(m, identities.get(m.senderId)!));
}

export type SendChatGroupMessageResult = { ok: true; message: ChatGroupMessageDTO } | { ok: false; reason: "not_member" | "empty" };

export async function sendChatGroupMessage(chatGroupId: string, senderId: string, body: string): Promise<SendChatGroupMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (!(await isChatGroupMember(chatGroupId, senderId))) return { ok: false, reason: "not_member" };

  const [row, group, senderIdentity] = await Promise.all([
    prisma.chatGroupMessage.create({ data: { chatGroupId, senderId, body: trimmed } }),
    prisma.chatGroup.findUnique({ where: { id: chatGroupId }, include: { members: { select: { userId: true } } } }),
    getDisplayIdentity(senderId),
  ]);
  const message = chatGroupMessageDTO(row, senderIdentity);

  const senderName = senderIdentity.battletag ?? senderIdentity.characterName ?? "Someone";
  for (const m of group?.members ?? []) {
    if (m.userId === senderId) continue;
    notifyUser(m.userId, {
      title: group!.name,
      body: `${senderName}: ${trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed}`,
      url: "/network",
    }).catch((err) => console.error("notifyUser chat group message failed", err));
    networkBroadcaster.publish(m.userId, { type: "chat_group_message", chatGroupId, senderId });
  }
  networkBroadcaster.publish(senderId, { type: "chat_group_message", chatGroupId, senderId }); // other open tabs of the sender's own account

  return { ok: true, message };
}

export async function markChatGroupRead(chatGroupId: string, userId: string): Promise<void> {
  await prisma.chatGroupMember.updateMany({ where: { chatGroupId, userId }, data: { lastReadAt: new Date() } });
}
