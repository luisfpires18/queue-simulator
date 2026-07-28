"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TeamDTO } from "@/data/dto";
import { CLASS_BY_ID, specById, type ClassId, type Role } from "@/game/classes";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { RoleIcon } from "@/components/RoleIcon";
import { SpecIcon } from "@/components/SpecIcon";
import { WowIcon } from "@/components/WowIcon";

/** The team roster. Opened from the profile status chip and from a board
 * card. The owner can remove anyone; a member can remove themselves. */
export function TeamMembersModal({
  team, open, onClose, viewerUserId,
}: {
  team: TeamDTO;
  open: boolean;
  onClose: () => void;
  /** null when signed out - the roster is still readable, just not editable. */
  viewerUserId: string | null;
}) {
  const router = useRouter();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isOwner = viewerUserId != null && viewerUserId === team.ownerUserId;

  const remove = async (userId: string) => {
    setBusyUserId(userId);
    setErr(null);
    try {
      await apiPost(`/api/teams/${team.id}/members/${userId}`, undefined, "DELETE");
      router.refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not remove that member.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <WowIcon slug={team.iconSlug} size={36} cdnSize="medium" />
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{team.name}</div>
          <div className="text-[11px] text-gray-500">
            {team.members.length} member{team.members.length === 1 ? "" : "s"}
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>

      {team.description && <p className="text-xs text-gray-400 whitespace-pre-wrap">{team.description}</p>}

      {err && <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{err}</p>}

      <div className="space-y-1.5">
        {team.members.map((m) => {
          const cls = CLASS_BY_ID[m.classId as ClassId];
          const spec = m.specId ? specById(m.specId) : null;
          const isSelf = viewerUserId === m.userId;
          const canRemove = !m.isOwner && (isOwner || isSelf);
          return (
            <div key={m.userId} className="flex items-center gap-2.5 rounded-md border border-panelborder bg-panel2/60 p-2">
              {m.specId ? (
                <SpecIcon specId={m.specId} size={32} />
              ) : (
                <RoleIcon role={m.role as Role} size={32} rounded="sm" />
              )}
              <div className="min-w-0">
                <Link
                  href={`/u/${encodeURIComponent(m.characterRealmSlug)}/${encodeURIComponent(m.characterName)}`}
                  className="text-sm font-semibold truncate hover:underline"
                  style={{ color: cls?.color }}
                >
                  {m.characterName}
                </Link>
                <div className="text-[11px] text-gray-500 truncate">
                  {spec ? `${spec.name} ${cls?.name ?? ""}` : m.role} - {m.characterRealm}
                  {m.isOwner && <span className="text-gold ml-1.5">Leader</span>}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {m.characterRating != null && (
                  <span className="text-xs font-bold text-accent tabular-nums">{Math.round(m.characterRating)}</span>
                )}
                {canRemove && (
                  <button
                    onClick={() => remove(m.userId)}
                    disabled={busyUserId === m.userId}
                    className="chip border border-rose-500/50 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {isSelf ? "Leave" : "Remove"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
