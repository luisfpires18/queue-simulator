"use client";

// React Query hooks for the client's recurring reads. Mutations stay plain
// apiFetch/apiPost calls at their call sites - the value here is dedup,
// caching, and the declarative polling; wrapping every one-shot POST in
// useMutation would be churn without payoff.
//
// staleTime 0 on purpose: these back live UI (application status, queue
// state) and the pre-React-Query code refetched on every mount, so serving
// a cached result for 10s would be a behavior change, not an optimization.
import { useQuery } from "@tanstack/react-query";
import type {
  ApplicationWithRatingDTO,
  ChatGroupDTO,
  ChatGroupMessageDTO,
  ChatGroupSummaryDTO,
  FriendDTO,
  FriendRequestDTO,
  FriendshipStatus,
  MessageDTO,
  MyApplicationStateDTO,
  SoloQueueStatusDTO,
} from "@/data/dto";
import type { Role } from "@/game/classes";
import { apiFetch } from "./api-client";

export const queryKeys = {
  soloQueueStatus: ["solo-queue-status"] as const,
  myApplication: (groupId: string) => ["my-application", groupId] as const,
  pendingApplications: (groupId: string, role: string, page: number) =>
    ["pending-applications", groupId, role, page] as const,
  friends: ["friends"] as const,
  friendRequests: ["friend-requests"] as const,
  friendshipStatus: (userId: string) => ["friendship-status", userId] as const,
  messages: (friendUserId: string) => ["messages", friendUserId] as const,
  chatGroups: ["chat-groups"] as const,
  chatGroup: (groupId: string) => ["chat-group", groupId] as const,
  chatGroupMessages: (groupId: string) => ["chat-group-messages", groupId] as const,
};

/** The caller's Solo Queue state. Polls every 4s while queued/matched - the
 * GET itself drives a server-side match pass, so this poll IS the retry
 * loop, not just a status read (see /api/solo-queue GET). `initialData`
 * (from the page's server render, see getMySoloQueueStatus) makes the first
 * paint show the real status instead of flashing "idle"/"Find Group";
 * staleTime 0 still triggers an immediate background refetch. */
export function useSoloQueueStatus(pollMs: number, initialData?: SoloQueueStatusDTO) {
  return useQuery({
    queryKey: queryKeys.soloQueueStatus,
    queryFn: () => apiFetch<SoloQueueStatusDTO>("/api/solo-queue"),
    staleTime: 0,
    initialData,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "matched" ? pollMs : false;
    },
  });
}

export type MyApplicationResponse = MyApplicationStateDTO;

/** The caller's own application to one group (Apply button state).
 * `initialData` (from the page's server render, see getMyApplicationsByGroup)
 * makes the first paint show the real button state; staleTime 0 still
 * refetches in the background right away to keep it fresh. */
export function useMyApplication(groupId: string, enabled: boolean, initialData?: MyApplicationStateDTO) {
  return useQuery({
    queryKey: queryKeys.myApplication(groupId),
    queryFn: () => apiFetch<MyApplicationStateDTO>(`/api/groups/${groupId}/my-application`),
    staleTime: 0,
    enabled,
    initialData,
  });
}

export interface PendingApplicationsResponse {
  applications: ApplicationWithRatingDTO[];
  total: number;
  page: number;
  pageSize: number;
  countsByRole: Record<Role, number>;
}

/** Owner-only pending-applications page for one group/role tab. */
export function usePendingApplications(groupId: string, role: "ALL" | Role, page: number, pageSize: number) {
  const roleParam = role === "ALL" ? "" : `&role=${role}`;
  return useQuery({
    queryKey: queryKeys.pendingApplications(groupId, role, page),
    queryFn: () =>
      apiFetch<PendingApplicationsResponse>(
        `/api/groups/${groupId}/applications?page=${page}&pageSize=${pageSize}${roleParam}`
      ),
    staleTime: 0,
  });
}

/** The caller's friends list, each with an unread-message count. `initialData`
 * (from the /network page's server render) makes the first paint show real
 * data; staleTime 0 still refetches right away and on every SSE event. */
export function useFriends(initialData?: FriendDTO[]) {
  return useQuery({
    queryKey: queryKeys.friends,
    queryFn: () => apiFetch<{ friends: FriendDTO[] }>("/api/network/friends").then((r) => r.friends),
    staleTime: 0,
    initialData,
  });
}

export interface FriendRequestsResponse {
  incoming: FriendRequestDTO[];
  outgoing: FriendRequestDTO[];
}

export function useFriendRequests(initialData?: FriendRequestsResponse) {
  return useQuery({
    queryKey: queryKeys.friendRequests,
    queryFn: () => apiFetch<FriendRequestsResponse>("/api/network/requests"),
    staleTime: 0,
    initialData,
  });
}

/** Backs the public-profile Add Friend button's state. */
export function useFriendshipStatus(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.friendshipStatus(userId),
    queryFn: () => apiFetch<{ status: FriendshipStatus }>(`/api/network/status/${userId}`).then((r) => r.status),
    staleTime: 0,
    enabled,
  });
}

export function useMessages(friendUserId: string, initialData?: MessageDTO[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.messages(friendUserId),
    queryFn: () => apiFetch<{ messages: MessageDTO[] }>(`/api/network/messages/${friendUserId}`).then((r) => r.messages),
    staleTime: 0,
    initialData,
    enabled,
  });
}

/** The caller's Team Groups, each with a member count, unread count, and
 * last-message preview. */
export function useChatGroups(initialData?: ChatGroupSummaryDTO[]) {
  return useQuery({
    queryKey: queryKeys.chatGroups,
    queryFn: () => apiFetch<{ groups: ChatGroupSummaryDTO[] }>("/api/network/groups").then((r) => r.groups),
    staleTime: 0,
    initialData,
  });
}

/** Full detail for one group (members, ownership, per-member friendship
 * status relative to the caller) — the dock's group header + info panel. */
export function useChatGroup(groupId: string, initialData?: ChatGroupDTO, enabled = true) {
  return useQuery({
    queryKey: queryKeys.chatGroup(groupId),
    queryFn: () => apiFetch<{ group: ChatGroupDTO }>(`/api/network/groups/${groupId}`).then((r) => r.group),
    staleTime: 0,
    initialData,
    enabled,
  });
}

export function useChatGroupMessages(groupId: string, initialData?: ChatGroupMessageDTO[], enabled = true) {
  return useQuery({
    queryKey: queryKeys.chatGroupMessages(groupId),
    queryFn: () => apiFetch<{ messages: ChatGroupMessageDTO[] }>(`/api/network/groups/${groupId}/messages`).then((r) => r.messages),
    staleTime: 0,
    initialData,
    enabled,
  });
}
