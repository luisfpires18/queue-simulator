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
  DeclineReasonDTO,
  DeclineRecordDTO,
  FriendDTO,
  FriendRequestDTO,
  FriendshipStatus,
  MessageDTO,
  MyApplicationStateDTO,
  MyTeamApplicationStateDTO,
  SoloQueueStatusDTO,
  TeamApplicationWithRatingDTO,
} from "@/data/dto";
import type { Role } from "@/game/classes";
import type { DeclineSide } from "@/data/declineRecords";
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
  myTeamApplication: (teamId: string) => ["my-team-application", teamId] as const,
  pendingTeamApplications: (teamId: string, role: string, page: number) =>
    ["pending-team-applications", teamId, role, page] as const,
  declineReasons: ["decline-reasons"] as const,
  declineHistory: (side: DeclineSide, page: number) => ["decline-history", side, page] as const,
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

/** Owner-only pending-applications page for one group/role tab. `enabled`
 * (pass the modal's own `open` state) keeps this from firing for every
 * owned card on every page load - the badge count already comes from
 * `initialCount` (see getPendingCountsByGroup), so the full list only needs
 * to load once the modal actually opens. staleTime 0 + re-enabling on open
 * still means each reopen shows fresh data. */
export function usePendingApplications(groupId: string, role: "ALL" | Role, page: number, pageSize: number, enabled: boolean) {
  const roleParam = role === "ALL" ? "" : `&role=${role}`;
  return useQuery({
    queryKey: queryKeys.pendingApplications(groupId, role, page),
    queryFn: () =>
      apiFetch<PendingApplicationsResponse>(
        `/api/groups/${groupId}/applications?page=${page}&pageSize=${pageSize}${roleParam}`
      ),
    staleTime: 0,
    enabled,
  });
}

/** The caller's own application to one team (Apply button state), seeded from
 * the /teams server render the same way useMyApplication is. */
export function useMyTeamApplication(teamId: string, enabled: boolean, initialData?: MyTeamApplicationStateDTO) {
  return useQuery({
    queryKey: queryKeys.myTeamApplication(teamId),
    queryFn: () => apiFetch<MyTeamApplicationStateDTO>(`/api/teams/${teamId}/my-application`),
    staleTime: 0,
    enabled,
    initialData,
  });
}

export interface PendingTeamApplicationsResponse {
  applications: TeamApplicationWithRatingDTO[];
  total: number;
  page: number;
  pageSize: number;
  countsByRole: Record<Role, number>;
}

/** Owner-only pending-applications page for one team/role tab. `enabled` -
 * see the same note on usePendingApplications. */
export function usePendingTeamApplications(teamId: string, role: "ALL" | Role, page: number, pageSize: number, enabled: boolean) {
  const roleParam = role === "ALL" ? "" : `&role=${role}`;
  return useQuery({
    queryKey: queryKeys.pendingTeamApplications(teamId, role, page),
    queryFn: () =>
      apiFetch<PendingTeamApplicationsResponse>(
        `/api/teams/${teamId}/applications?page=${page}&pageSize=${pageSize}${roleParam}`
      ),
    staleTime: 0,
    enabled,
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

/** The decline-reason picker's options - shared across every GroupCard/
 * TeamCard that can open a DeclineDialog, instead of each one fetching its
 * own copy on every open. Not staleTime 0: this is a low-churn, admin-managed
 * global list (also cached server-side via unstable_cache, see
 * src/data/declineReasons.ts), not per-user live state. */
export function useDeclineReasons() {
  return useQuery({
    queryKey: queryKeys.declineReasons,
    queryFn: () => apiFetch<{ reasons: DeclineReasonDTO[] }>("/api/decline-reasons").then((r) => r.reasons),
    staleTime: 5 * 60_000,
  });
}

export interface DeclineHistoryResponse {
  records: DeclineRecordDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** The profile Feedback tab's decline history (either side, paginated).
 * `initialData` (from the profile page's server render, for the default
 * received/page-1 view) makes opening the tab show real data immediately
 * instead of flashing "Loading…" - only wired up for that one combination,
 * since anything else (switching side or page) is genuinely new data. */
export function useDeclineHistory(side: DeclineSide, page: number, initialData?: DeclineHistoryResponse) {
  return useQuery({
    queryKey: queryKeys.declineHistory(side, page),
    queryFn: () => apiFetch<DeclineHistoryResponse>(`/api/profile/declines?side=${side}&page=${page}`),
    staleTime: 10_000,
    initialData: side === "received" && page === 1 ? initialData : undefined,
  });
}
