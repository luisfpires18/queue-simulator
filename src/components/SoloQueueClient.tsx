"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { CurrentSelectionDTO, SoloQueueStatusDTO } from "@/data/dto";
import { specById, type Role } from "@/game/classes";
import { DUNGEON_BY_ID } from "@/game/season";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { queryKeys, useSoloQueueStatus } from "@/lib/queries";
import { SpecIcon } from "./SpecIcon";
import { RoleIcon } from "./RoleIcon";
import { ROLE_LABEL } from "./GroupFormShared";

const POLL_MS = 4000;
const MIN_KEY = 2;
const MAX_KEY = 25;

/** Solo Queue for the navbar's current character/spec (same "who you're
 * acting as" convention as ListKeyForm/RaidListForm). No proposal/decline
 * state is ever shown here - only idle/queued/matched - matching the leader
 * accept/decline flow in PendingRequestsModal, which is where any proposal
 * or decline actually surfaces. Embedded as the first section of /runs
 * (BoardClient), not a standalone page, so the existing board filters are
 * always right there alongside it. */
export function SoloQueueClient({
  current, minKeyLevel = MIN_KEY, maxKeyLevel = MAX_KEY, dungeonIds = [], initialStatus,
}: {
  current: CurrentSelectionDTO;
  /** The board's own filter sidebar state (BoardClient) - matching happens
   * against these bounds, and they're shown as a note so it's clear what
   * you're actually queuing for. Defaults to "no restriction". */
  minKeyLevel?: number;
  maxKeyLevel?: number;
  dungeonIds?: string[];
  /** Server-rendered seed (see getMySoloQueueStatus) - first paint shows the
   * real idle/queued/matched state; the poll still revalidates right away. */
  initialStatus?: SoloQueueStatusDTO;
}) {
  const specId = current.specId;
  const role = (specById(specId)?.role ?? "DPS") as Role;

  const levelUnrestricted = minKeyLevel <= MIN_KEY && maxKeyLevel >= MAX_KEY;
  const dungeonNames = dungeonIds.map((id) => DUNGEON_BY_ID[id]?.name ?? id);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Polls every 4s while queued - and in "matched" too: the leader can
  // delist the key after accepting (getMySoloQueueStatus self-heals that
  // back to "idle" server-side), and without a live poll the client would
  // keep showing a dead "See Key Listed" link until the next full reload.
  const { data } = useSoloQueueStatus(POLL_MS, initialStatus);
  const status = data?.status ?? "idle";
  const groupId = data?.groupId ?? null;

  function setQueueState(next: SoloQueueStatusDTO) {
    queryClient.setQueryData(queryKeys.soloQueueStatus, next);
  }

  async function find() {
    setErr(null);
    setBusy(true);
    try {
      const next = await apiPost<SoloQueueStatusDTO>("/api/solo-queue", {
        characterId: current.character.id, specId, role,
        minKeyLevel: levelUnrestricted ? null : minKeyLevel,
        maxKeyLevel: levelUnrestricted ? null : maxKeyLevel,
        dungeonIds,
      });
      setQueueState(next);
    } catch (e) {
      if (e instanceof ApiClientError) setErr(`Couldn't join the queue (${e.status}).`);
      else setErr(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      const next = await apiPost<SoloQueueStatusDTO>("/api/solo-queue", undefined, "DELETE");
      setQueueState(next);
    } catch {
      // matches the old fire-and-forget DELETE: treat as left either way
      setQueueState({ status: "idle", groupId: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-6 space-y-5">
      <div className="flex items-center gap-3">
        <SpecIcon specId={specId} size={40} />
        <div>
          <div className="text-sm font-semibold">
            {current.character.name} <span className="text-gray-500 text-xs">- {current.character.realm}</span>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            Queuing as
            <RoleIcon role={role} size={14} rounded="sm" />
            <span className="text-gray-300 font-semibold">{ROLE_LABEL[role]}</span>
          </p>
        </div>
        <p className="ml-auto text-[11px] text-gray-500">Change character in the navbar picker ↑</p>
      </div>

      <p className="text-[11px] text-gray-500 -mt-2">
        Matching against{" "}
        <span className="text-gray-300">{levelUnrestricted ? "any key level" : `+${minKeyLevel}–${maxKeyLevel}`}</span>
        {dungeonNames.length > 0 && (
          <>
            {" "}in <span className="text-gray-300">{dungeonNames.join(", ")}</span>
          </>
        )}
        {" "}- set in the filters sidebar.
      </p>

      {status === "idle" && (
        <button onClick={find} disabled={busy} className="btn-gold w-full">
          {busy ? "Joining…" : "Find Group"}
        </button>
      )}

      {status === "queued" && (
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
            Searching for a group…
          </div>
          <button onClick={cancel} disabled={busy} className="btn-ghost w-full">
            {busy ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      )}

      {status === "matched" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-emerald-300 font-semibold">You're in! A leader accepted your queue match.</p>
          <Link
            href={groupId ? `/runs?highlight=${groupId}` : "/runs"}
            className="btn-gold w-full block text-center"
          >
            See Key Listed
          </Link>
        </div>
      )}

      {err && <p className="text-rose-400 text-sm text-center">{err}</p>}
    </div>
  );
}
