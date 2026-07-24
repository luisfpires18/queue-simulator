"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatGroupSummaryDTO, FriendDTO, FriendRequestDTO } from "@/data/dto";
import { ApiClientError, apiFetch, apiPost } from "@/lib/api-client";
import { queryKeys, useChatGroups, useFriendRequests, useFriends, type FriendRequestsResponse } from "@/lib/queries";
import { IdentityBadge } from "./IdentityBadge";
import { FriendCircle } from "./FriendCircle";
import { GroupCircle } from "./GroupCircle";
import { NewChatGroupModal } from "./NewChatGroupModal";
import { cn } from "@/lib/utils";

type Tab = "friends" | "groups";

const GRID = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1";

export function NetworkClient({
  initialFriends, initialRequests, initialGroups,
}: {
  initialFriends: FriendDTO[];
  initialRequests: FriendRequestsResponse;
  initialGroups: ChatGroupSummaryDTO[];
}) {
  const [tab, setTab] = useState<Tab>("friends");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const queryClient = useQueryClient();

  // No useNetworkStream() call here — AccountMenuClient (mounted in the
  // header on every page) owns the one SSE connection per tab; this just
  // reads the same react-query cache it keeps live.
  const { data: friends } = useFriends(initialFriends);
  const { data: requests } = useFriendRequests(initialRequests);
  const { data: groups } = useChatGroups(initialGroups);
  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];
  const hasRequests = incoming.length > 0 || outgoing.length > 0;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests });
  }

  async function run(id: string, action: () => Promise<unknown>, fallback: string) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      invalidate();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : fallback);
    } finally {
      setBusyId(null);
    }
  }

  const onlineCount = (friends ?? []).filter((f) => f.online).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
          Friends {friends && friends.length > 0 && <span className="opacity-60">({friends.length})</span>}
          {incoming.length > 0 && <span className="chip bg-amber-500/20 text-amber-300 px-1.5 py-0 ml-1">{incoming.length}</span>}
        </TabButton>
        <TabButton active={tab === "groups"} onClick={() => setTab("groups")}>
          Groups {groups && groups.length > 0 && <span className="opacity-60">({groups.length})</span>}
        </TabButton>
        {tab === "friends" && friends && friends.length > 0 && (
          <span className="ml-auto text-xs text-gray-500 tabular-nums">
            <span className="text-emerald-400 font-semibold">{onlineCount}</span> / {friends.length} online
          </span>
        )}
        {tab === "groups" && (
          <button
            onClick={() => setNewGroupOpen(true)}
            title="New group"
            className="ml-auto w-7 h-7 grid place-items-center rounded-full border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 text-lg leading-none"
          >
            +
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{error}</p>
      )}

      {tab === "friends" ? (
        <div className="space-y-4">
          {hasRequests && (
            <div className="space-y-1.5">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Requests</h2>
              <div className="space-y-1.5">
                {incoming.map((r) => (
                  <div key={r.id} className="rounded-md border border-panelborder bg-panel2/40 p-2 flex items-center gap-3">
                    <IdentityBadge identity={r.requester} size={28} />
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => run(r.id, () => apiPost(`/api/network/requests/${r.id}/accept`), "Accept failed.")}
                        className="chip border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Accept
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => run(r.id, () => apiPost(`/api/network/requests/${r.id}/decline`), "Decline failed.")}
                        className="chip border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
                {outgoing.map((r: FriendRequestDTO) => (
                  <div key={r.id} className="rounded-md border border-panelborder bg-panel2/40 p-2 flex items-center gap-3">
                    <IdentityBadge identity={r.addressee} size={28} />
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-500 shrink-0">Sent</span>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => run(r.id, () => apiFetch(`/api/network/requests/${r.id}`, { method: "DELETE" }), "Cancel failed.")}
                      className="chip border border-panelborder text-gray-400 hover:border-rose-500/50 hover:text-rose-300 shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!friends || friends.length === 0 ? (
            <div className="panel p-10 text-center text-gray-500">
              No friends yet. Add one from a player&apos;s public profile.
            </div>
          ) : (
            <div className={GRID}>
              {friends.map((f) => (
                <FriendCircle
                  key={f.userId}
                  friend={f}
                  busy={busyId === f.userId}
                  onRemove={() => run(f.userId, () => apiFetch(`/api/network/friends/${f.userId}`, { method: "DELETE" }), "Failed to remove friend.")}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!groups || groups.length === 0 ? (
            <div className="panel p-10 text-center text-gray-500">No groups yet.</div>
          ) : (
            <div className={GRID}>
              {groups.map((g) => (
                <GroupCircle key={g.id} group={g} />
              ))}
            </div>
          )}

          <NewChatGroupModal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "chip border",
        active ? "border-accent text-accent bg-accent/10" : "border-panelborder text-gray-400"
      )}
    >
      {children}
    </button>
  );
}
