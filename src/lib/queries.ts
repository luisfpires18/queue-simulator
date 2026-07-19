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
import type { ApplicationWithRatingDTO, MyApplicationStateDTO, SoloQueueStatusDTO } from "@/data/dto";
import type { Role } from "@/game/classes";
import { apiFetch } from "./api-client";

export const queryKeys = {
  soloQueueStatus: ["solo-queue-status"] as const,
  myApplication: (groupId: string) => ["my-application", groupId] as const,
  pendingApplications: (groupId: string, role: string, page: number) =>
    ["pending-applications", groupId, role, page] as const,
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
