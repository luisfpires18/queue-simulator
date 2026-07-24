// Team Group lifecycle + membership: create, add/remove members, rename,
// leave, delete. Mirrors src/data/network.ts's style — plain string state
// where relevant, thin transactions, notifyUser + networkBroadcaster fired
// from the service layer, never from route handlers.
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/server/notifications/dispatch";
import { networkBroadcaster, type NetworkEvent } from "@/server/network/broadcaster";
import { areFriends, getDisplayIdentity, getFriendshipStatus } from "./network";
import type { ChatGroupActionResult, ChatGroupDTO, ChatGroupMemberDTO, ChatGroupSummaryDTO, CreateChatGroupResult } from "./dto";

const MAX_GROUP_MEMBERS = 50;

/** Picks who inherits ownership when the owner leaves: the earliest-joined
 * remaining member. Null means no one's left (the group should be deleted
 * instead). Pure so it can be unit-tested. */
export function pickNextOwner<T extends { userId: string; joinedAt: Date }>(members: T[], leavingUserId: string): string | null {
  const remaining = members.filter((m) => m.userId !== leavingUserId);
  if (remaining.length === 0) return null;
  return remaining.reduce((oldest, m) => (m.joinedAt < oldest.joinedAt ? m : oldest)).userId;
}

async function notifyMembers(chatGroupId: string, excludeUserId: string | null, event: NetworkEvent) {
  const members = await prisma.chatGroupMember.findMany({ where: { chatGroupId }, select: { userId: true } });
  for (const m of members) {
    if (m.userId === excludeUserId) continue;
    networkBroadcaster.publish(m.userId, event);
  }
}

/** Creates a group: the caller (owner) must be friends with every member
 * they're adding — no partial group if any of them isn't. Requires at least
 * one other member (a "group" of just yourself isn't one). */
export async function createChatGroup(ownerUserId: string, name: string, memberUserIds: string[]): Promise<CreateChatGroupResult> {
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, reason: "empty_name" };

  const uniqueMemberIds = [...new Set(memberUserIds)].filter((id) => id !== ownerUserId);
  if (uniqueMemberIds.length === 0) return { ok: false, reason: "no_members" };
  if (uniqueMemberIds.length + 1 > MAX_GROUP_MEMBERS) return { ok: false, reason: "too_many_members" };

  const friendChecks = await Promise.all(uniqueMemberIds.map((id) => areFriends(ownerUserId, id)));
  if (friendChecks.some((ok) => !ok)) return { ok: false, reason: "not_friends" };

  const group = await prisma.chatGroup.create({
    data: {
      name: trimmedName,
      ownerUserId,
      members: {
        create: [ownerUserId, ...uniqueMemberIds].map((userId) => ({ userId, addedByUserId: ownerUserId })),
      },
    },
  });

  for (const userId of uniqueMemberIds) {
    notifyUser(userId, { title: "Added to a group", body: `You're in "${trimmedName}".`, url: `/network` }).catch((err) =>
      console.error("notifyUser chat group create failed", err)
    );
  }
  await notifyMembers(group.id, ownerUserId, { type: "chat_group_updated", chatGroupId: group.id });

  const dto = await getChatGroup(group.id, ownerUserId);
  return dto ? { ok: true, group: dto } : { ok: false, reason: "no_members" }; // dto is never null here — the caller is a member they just created
}

/** Owner-only: adds a member they're friends with. */
export async function addChatGroupMember(chatGroupId: string, ownerUserId: string, newMemberUserId: string): Promise<ChatGroupActionResult> {
  const group = await prisma.chatGroup.findUnique({ where: { id: chatGroupId }, include: { _count: { select: { members: true } } } });
  if (!group) return { ok: false, reason: "not_found" };
  if (group.ownerUserId !== ownerUserId) return { ok: false, reason: "not_owner" };
  if (!(await areFriends(ownerUserId, newMemberUserId))) return { ok: false, reason: "not_friends" };
  if (group._count.members >= MAX_GROUP_MEMBERS) return { ok: false, reason: "not_found" };

  const existing = await prisma.chatGroupMember.findUnique({ where: { chatGroupId_userId: { chatGroupId, userId: newMemberUserId } } });
  if (existing) return { ok: true }; // already a member — idempotent

  await prisma.chatGroupMember.create({ data: { chatGroupId, userId: newMemberUserId, addedByUserId: ownerUserId } });
  notifyUser(newMemberUserId, { title: "Added to a group", body: `You're in "${group.name}".`, url: "/network" }).catch((err) =>
    console.error("notifyUser chat group add failed", err)
  );
  await notifyMembers(chatGroupId, null, { type: "chat_group_updated", chatGroupId });
  return { ok: true };
}

/** Owner-only: removes someone else. The owner can't remove themselves this
 * way — see leaveChatGroup / deleteChatGroup. */
export async function removeChatGroupMember(chatGroupId: string, ownerUserId: string, targetUserId: string): Promise<ChatGroupActionResult> {
  const group = await prisma.chatGroup.findUnique({ where: { id: chatGroupId } });
  if (!group) return { ok: false, reason: "not_found" };
  if (group.ownerUserId !== ownerUserId) return { ok: false, reason: "not_owner" };
  if (targetUserId === group.ownerUserId) return { ok: false, reason: "not_found" };

  await prisma.chatGroupMember.deleteMany({ where: { chatGroupId, userId: targetUserId } });
  await notifyMembers(chatGroupId, null, { type: "chat_group_updated", chatGroupId });
  return { ok: true };
}

/** Leaves a group the caller belongs to. Deletes the group outright if that
 * was the last member; transfers ownership to the earliest-joined remaining
 * member (pickNextOwner) if the owner leaves and others remain. */
export async function leaveChatGroup(chatGroupId: string, userId: string): Promise<ChatGroupActionResult> {
  const group = await prisma.chatGroup.findUnique({ where: { id: chatGroupId }, include: { members: true } });
  if (!group || !group.members.some((m) => m.userId === userId)) return { ok: false, reason: "not_found" };

  const nextOwner = pickNextOwner(group.members, userId);
  if (nextOwner === null) {
    await prisma.chatGroup.delete({ where: { id: chatGroupId } }); // cascades members + messages
    return { ok: true };
  }

  await prisma.$transaction([
    prisma.chatGroupMember.deleteMany({ where: { chatGroupId, userId } }),
    ...(group.ownerUserId === userId
      ? [prisma.chatGroup.update({ where: { id: chatGroupId }, data: { ownerUserId: nextOwner } })]
      : []),
  ]);
  networkBroadcaster.publish(userId, { type: "chat_group_updated", chatGroupId }); // so the leaver's own UI drops it
  await notifyMembers(chatGroupId, userId, { type: "chat_group_updated", chatGroupId });
  return { ok: true };
}

export async function renameChatGroup(chatGroupId: string, ownerUserId: string, name: string): Promise<ChatGroupActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "not_found" };
  const group = await prisma.chatGroup.findUnique({ where: { id: chatGroupId } });
  if (!group) return { ok: false, reason: "not_found" };
  if (group.ownerUserId !== ownerUserId) return { ok: false, reason: "not_owner" };

  await prisma.chatGroup.update({ where: { id: chatGroupId }, data: { name: trimmed } });
  await notifyMembers(chatGroupId, null, { type: "chat_group_updated", chatGroupId });
  return { ok: true };
}

export async function deleteChatGroup(chatGroupId: string, ownerUserId: string): Promise<ChatGroupActionResult> {
  const group = await prisma.chatGroup.findUnique({ where: { id: chatGroupId }, include: { members: { select: { userId: true } } } });
  if (!group) return { ok: false, reason: "not_found" };
  if (group.ownerUserId !== ownerUserId) return { ok: false, reason: "not_owner" };

  await prisma.chatGroup.delete({ where: { id: chatGroupId } });
  for (const m of group.members) networkBroadcaster.publish(m.userId, { type: "chat_group_updated", chatGroupId });
  return { ok: true };
}

/** The caller's groups, each with a member count, unread count (messages
 * from others since the caller's last-read watermark), and a last-message
 * preview. */
export async function listMyChatGroups(userId: string): Promise<ChatGroupSummaryDTO[]> {
  const memberships = await prisma.chatGroupMember.findMany({
    where: { userId },
    include: {
      chatGroup: {
        include: {
          _count: { select: { members: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return Promise.all(
    memberships.map(async (m) => {
      const unreadCount = await prisma.chatGroupMessage.count({
        where: {
          chatGroupId: m.chatGroupId,
          senderId: { not: userId },
          createdAt: { gt: m.lastReadAt ?? new Date(0) },
        },
      });
      const last = m.chatGroup.messages[0];
      return {
        id: m.chatGroup.id,
        name: m.chatGroup.name,
        ownerUserId: m.chatGroup.ownerUserId,
        memberCount: m.chatGroup._count.members,
        unreadCount,
        lastMessage: last ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt.toISOString() } : null,
      };
    })
  );
}

/** Full detail for one group, gated on the viewer being a member (null
 * otherwise — the caller should treat that as a 404). Each member's
 * friendshipStatus is relative to the VIEWER, not the owner — that's what
 * lets the UI offer "Add Friend" for non-friend co-members. */
export async function getChatGroup(chatGroupId: string, viewerUserId: string): Promise<ChatGroupDTO | null> {
  const group = await prisma.chatGroup.findUnique({
    where: { id: chatGroupId },
    include: { members: { orderBy: { joinedAt: "asc" } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!group) return null;
  const viewerMembership = group.members.find((m) => m.userId === viewerUserId);
  if (!viewerMembership) return null;

  const members: ChatGroupMemberDTO[] = await Promise.all(
    group.members.map(async (m) => ({
      userId: m.userId,
      identity: await getDisplayIdentity(m.userId),
      isOwner: m.userId === group.ownerUserId,
      joinedAt: m.joinedAt.toISOString(),
      friendshipStatus: m.userId === viewerUserId ? "friends" : await getFriendshipStatus(viewerUserId, m.userId),
    }))
  );

  const unreadCount = await prisma.chatGroupMessage.count({
    where: { chatGroupId, senderId: { not: viewerUserId }, createdAt: { gt: viewerMembership.lastReadAt ?? new Date(0) } },
  });
  const last = group.messages[0];

  return {
    id: group.id,
    name: group.name,
    ownerUserId: group.ownerUserId,
    memberCount: group.members.length,
    unreadCount,
    lastMessage: last ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt.toISOString() } : null,
    members,
    isOwner: group.ownerUserId === viewerUserId,
  };
}

export async function isChatGroupMember(chatGroupId: string, userId: string): Promise<boolean> {
  const m = await prisma.chatGroupMember.findUnique({ where: { chatGroupId_userId: { chatGroupId, userId } } });
  return m != null;
}
