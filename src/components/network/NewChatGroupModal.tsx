"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import type { ChatGroupDTO, FriendDTO } from "@/data/dto";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { queryKeys, useFriends } from "@/lib/queries";
import { useChatDock } from "./ChatDockContext";
import { IdentityBadge } from "./IdentityBadge";

/** "New Group" creation form: a name + a checklist over the caller's own
 * friends (the only people you're allowed to add — see createChatGroup). */
export function NewChatGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: friends } = useFriends();
  const { openChat } = useChatDock();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function reset() {
    setName("");
    setSelected(new Set());
    setError(null);
  }

  async function create() {
    if (!name.trim() || selected.size === 0 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { group } = await apiPost<{ group: ChatGroupDTO }>("/api/network/groups", {
        name: name.trim(),
        memberUserIds: [...selected],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatGroups });
      reset();
      onClose();
      openChat({ kind: "group", groupId: group.id });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      panelClassName="panel w-full max-w-sm max-h-[80vh] overflow-y-auto p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">New Group</span>
        <button onClick={() => { reset(); onClose(); }} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Group name"
        className="w-full rounded-md border border-panelborder bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {error && <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{error}</p>}

      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">Add friends ({selected.size} selected)</p>
        {!friends || friends.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Add some friends first.</p>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {friends.map((f: FriendDTO) => (
              <label
                key={f.userId}
                className="flex items-center gap-2 rounded-md border border-panelborder bg-panel2/40 p-2 cursor-pointer hover:border-accent/50"
              >
                <input type="checkbox" checked={selected.has(f.userId)} onChange={() => toggle(f.userId)} className="shrink-0" />
                <IdentityBadge identity={f.identity} size={26} />
              </label>
            ))}
          </div>
        )}
      </div>

      <button onClick={create} disabled={!name.trim() || selected.size === 0 || creating} className="btn-gold w-full py-2">
        {creating ? "Creating..." : "Create group"}
      </button>
    </Modal>
  );
}
