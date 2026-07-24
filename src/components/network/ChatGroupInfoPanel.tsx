"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ApiClientError, apiFetch, apiPost } from "@/lib/api-client";
import { queryKeys, useChatGroup, useFriends } from "@/lib/queries";
import { useChatDock } from "./ChatDockContext";
import { IdentityBadge } from "./IdentityBadge";

/** Member list + management for a Team Group, opened from the "ⓘ" button in
 * either dock chrome (ChatDock.tsx). Owner can add/remove members, rename,
 * and delete; anyone can leave; any co-member who isn't a mutual friend yet
 * gets an inline "Add Friend" — the "they can connect tho" part of the spec. */
export function ChatGroupInfoPanel({
  groupId, open, onClose, onLeftOrDeleted,
}: {
  groupId: string;
  open: boolean;
  onClose: () => void;
  onLeftOrDeleted: () => void;
}) {
  const { currentUserId } = useChatDock();
  const queryClient = useQueryClient();
  const { data: group } = useChatGroup(groupId, undefined, open);
  const { data: friends } = useFriends();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  function invalidateGroup() {
    queryClient.invalidateQueries({ queryKey: queryKeys.chatGroup(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.chatGroups });
  }

  async function run(id: string, action: () => Promise<unknown>, fallback: string) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      invalidateGroup();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : fallback);
    } finally {
      setBusyId(null);
    }
  }

  if (!group) return null;

  const isOwner = group.isOwner;
  const memberIds = new Set(group.members.map((m) => m.userId));
  const addableFriends = (friends ?? []).filter((f) => !memberIds.has(f.userId));

  async function saveRename() {
    const name = nameDraft.trim();
    if (!name || name === group!.name) return setRenaming(false);
    await run("rename", () => apiPost(`/api/network/groups/${groupId}`, { name }, "PATCH"), "Rename failed.");
    setRenaming(false);
  }

  async function addFriend(userId: string) {
    await run(userId, () => apiPost("/api/network/requests", { targetUserId: userId }), "Failed to send friend request.");
  }

  async function addMember(userId: string) {
    await run(userId, () => apiPost(`/api/network/groups/${groupId}/members`, { userId }), "Failed to add member.");
    setAddingMember(false);
  }

  async function removeMember(userId: string) {
    await run(userId, () => apiFetch(`/api/network/groups/${groupId}/members/${userId}`, { method: "DELETE" }), "Failed to remove member.");
  }

  async function leaveOrDelete(kind: "leave" | "delete") {
    setBusyId(kind);
    setError(null);
    try {
      if (kind === "delete") await apiFetch(`/api/network/groups/${groupId}`, { method: "DELETE" });
      else await apiFetch(`/api/network/groups/${groupId}/members/${currentUserId}`, { method: "DELETE" });
      invalidateGroup();
      onClose();
      onLeftOrDeleted();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : `Failed to ${kind} group.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-sm max-h-[80vh] overflow-y-auto p-4 space-y-3" overlayClassName="z-[55]">
        <div className="flex items-center justify-between gap-2">
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveRename()}
              onBlur={saveRename}
              maxLength={60}
              className="flex-1 min-w-0 rounded-md border border-panelborder bg-panel2 px-2 py-1 text-sm outline-none focus:border-accent"
            />
          ) : (
            <span
              className="text-sm font-bold truncate"
              onClick={() => {
                if (!isOwner) return;
                setNameDraft(group.name);
                setRenaming(true);
              }}
              title={isOwner ? "Click to rename" : undefined}
            >
              {group.name}
            </span>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none shrink-0">✕</button>
        </div>

        {error && <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{error}</p>}

        <div className="space-y-1.5">
          {group.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 rounded-md border border-panelborder bg-panel2/40 p-2">
              <IdentityBadge identity={m.identity} size={28} />
              {m.isOwner && <span className="chip border border-amber-500/40 bg-amber-500/10 text-amber-300 shrink-0">Owner</span>}
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {m.userId !== currentUserId && m.friendshipStatus === "none" && (
                  <button
                    onClick={() => addFriend(m.userId)}
                    disabled={busyId === m.userId}
                    className="chip border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20"
                  >
                    Add Friend
                  </button>
                )}
                {m.userId !== currentUserId && m.friendshipStatus === "pending_outgoing" && (
                  <span className="chip border border-panelborder text-gray-500">Request sent</span>
                )}
                {isOwner && !m.isOwner && (
                  <button
                    onClick={() => removeMember(m.userId)}
                    disabled={busyId === m.userId}
                    className="chip border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {isOwner && (
          <div className="space-y-2">
            {addingMember ? (
              <div className="rounded-md border border-panelborder bg-panel2/40 p-2 space-y-1.5 max-h-40 overflow-y-auto">
                {addableFriends.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-2">All your friends are already in this group.</p>
                ) : (
                  addableFriends.map((f) => (
                    <button
                      key={f.userId}
                      onClick={() => addMember(f.userId)}
                      disabled={busyId === f.userId}
                      className="w-full flex items-center gap-2 rounded p-1 hover:bg-panel2 text-left"
                    >
                      <IdentityBadge identity={f.identity} size={24} />
                    </button>
                  ))
                )}
              </div>
            ) : (
              <button onClick={() => setAddingMember(true)} className="chip border border-panelborder text-gray-300 hover:border-accent/50 w-full justify-center">
                + Add member
              </button>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-panelborder flex gap-2">
          {isOwner ? (
            <>
              <button onClick={() => setConfirmLeave(true)} className="chip border border-panelborder text-gray-400 hover:border-rose-500/50 hover:text-rose-300 flex-1 justify-center">
                Leave group
              </button>
              <button onClick={() => setConfirmDelete(true)} className="chip border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 flex-1 justify-center">
                Delete group
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmLeave(true)} className="chip border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 flex-1 justify-center">
              Leave group
            </button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave group?"
        message={isOwner ? "Ownership will transfer to the next member, or the group will be deleted if you're the last one." : "You'll stop seeing this group's messages."}
        confirmLabel="Leave"
        onConfirm={() => { setConfirmLeave(false); leaveOrDelete("leave"); }}
        onCancel={() => setConfirmLeave(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete group?"
        message="This deletes the group and its message history for everyone."
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); leaveOrDelete("delete"); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
