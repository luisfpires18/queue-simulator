"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ApplicationDTO, CharacterRatingSummaryDTO, ComboMember, CurrentSelectionDTO, GroupDTO, MyApplicationStateDTO } from "@/data/dto";
import { DUNGEON_BY_ID } from "@/game/season";
import { RAID_BY_ID, RAID_DIFFICULTY_LABEL, type RaidDifficulty } from "@/game/raidSeason";
import { MISC_ICON } from "@/game/icons";
import { RoleIcon } from "./RoleIcon";
import { specById, CLASS_BY_ID, type Role } from "@/game/classes";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { ApplyModal } from "./ApplyModal";
import { PendingRequestsModal } from "./PendingRequestsModal";
import { CharacterRatingModal } from "./CharacterRatingModal";
import { GroupDetailsModal } from "./GroupDetailsModal";
import { CountdownLight } from "./CountdownLight";
import { ConfirmDialog } from "./ConfirmDialog";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { ROLE_LABEL } from "./GroupFormShared";
import { requirementChipLabel, startInfo } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { queryKeys, useMyApplication, type MyApplicationResponse } from "@/lib/queries";
import { cn } from "@/lib/utils";

type CardSlot =
  | { kind: "filled"; characterId: string; specId: string | null; classId: string; name: string; role: string }
  | { kind: "open"; role: string; prefs: string[] };

/** Ordered, deduped specs per role across all desired combos — the "priority"
 * an open slot implicitly accepts when the poster used combos instead of (or
 * alongside) per-slot prefs, so the two stay in sync on the card. */
function comboPrefsByRole(combos: ComboMember[][]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const combo of combos) {
    for (const m of combo) {
      const list = out[m.role] ?? (out[m.role] = []);
      if (!list.includes(m.specId)) list.push(m.specId);
    }
  }
  return out;
}

function specColor(specId?: string | null): string | undefined {
  const sp = specId ? specById(specId) : null;
  return sp ? CLASS_BY_ID[sp.classId]?.color : undefined;
}

const ROLE_BORDER: Record<string, string> = {
  TANK: "border-sky-400/40",
  HEALER: "border-emerald-400/40",
  DPS: "border-rose-400/40",
};

function SlotSquare({ slot, onClick }: { slot: CardSlot; onClick?: () => void }) {
  if (slot.kind === "filled") {
    const color = specColor(slot.specId);
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        title={onClick ? "View rating details" : undefined}
        className="flex flex-col items-center gap-1 w-16 disabled:cursor-default"
      >
        <div className="rounded-md p-0.5" style={{ background: color ? `${color}22` : undefined }}>
          <SpecIcon specId={slot.specId ?? `${slot.classId}:unknown`} size={44} />
        </div>
        <span className="text-[10px] text-gray-200 truncate w-full text-center">{slot.name}</span>
      </button>
    );
  }
  const count = slot.prefs.length;
  return (
    <div className="group relative flex flex-col items-center gap-1 w-16">
      {/* open slot = a ROLE need placeholder (gray); the accepted specs live in the popover */}
      <div
        className={cn(
          "relative w-[46px] h-[46px] rounded-md border border-dashed grid place-items-center bg-panel2/40",
          count > 0 && "cursor-help",
          ROLE_BORDER[slot.role]
        )}
      >
        <RoleIcon role={slot.role as Role} size={22} rounded="sm" className="grayscale opacity-60" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-accent text-black text-[9px] font-black px-1 leading-4 min-w-4 text-center">
            {count}
          </span>
        )}
      </div>
      <span className="text-[10px] text-gray-500">{ROLE_LABEL[slot.role as Role] ?? "open"}</span>

      {/* hover popover: full ordered accepted specs, in full colour */}
      {slot.prefs.length > 0 && (
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-44 panel p-2 shadow-card">
          <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">
            {ROLE_LABEL[slot.role as Role]} - accepts, in order
          </div>
          <ol className="space-y-1">
            {slot.prefs.map((id, i) => {
              const sp = specById(id);
              const cls = sp ? CLASS_BY_ID[sp.classId] : null;
              return (
                <li key={id} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-gray-500 w-2.5">{i + 1}</span>
                  <SpecIcon specId={id} size={20} showRole={false} />
                  <span className="text-[11px] truncate" style={{ color: cls?.color }}>{sp?.name}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function GroupCardInner({
  group, current, canApply, viewerUserId, highlighted, onDelisted, initialMyApp,
}: {
  group: GroupDTO;
  current: CurrentSelectionDTO | null;
  canApply: boolean;
  viewerUserId: string | null;
  /** Server-rendered seed for the viewer's application state (see
   * getMyApplicationsByGroup) - first paint shows the real Apply-button
   * state; the query still revalidates in the background. */
  initialMyApp?: MyApplicationStateDTO;
  /** True when this card is the target of a /runs?highlight=<id> deep link
   * (e.g. Solo Queue's "See Key Listed") - rings it so it stands out from
   * the rest of the board. */
  highlighted?: boolean;
  /** Called right after a successful delist so the caller (BoardClient) can
   * drop this card from its own `groups` state immediately - the board is
   * otherwise only ever updated by the 4s SSE tick, so without this the card
   * would visibly linger for up to 4 seconds after delisting. */
  onDelisted?: (groupId: string) => void;
}) {
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ characterId: string; specId: string } | null>(null);
  const [ratingSummary, setRatingSummary] = useState<CharacterRatingSummaryDTO | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const queryClient = useQueryClient();
  const isOwner = viewerUserId != null && viewerUserId === group.ownerUserId;
  const isFull = group.slots.length === 0;
  const isRaid = group.kind === "raid";
  const dungeon = group.dungeonId ? DUNGEON_BY_ID[group.dungeonId] : undefined;
  const raid = group.raidId ? RAID_BY_ID[group.raidId] : undefined;
  const requirementLabel = requirementChipLabel(group);
  const isConfirmedMember = viewerUserId != null && group.members.some((m) => m.userId === viewerUserId);

  const { data: myAppData } = useMyApplication(group.id, !isOwner && canApply, initialMyApp);
  const myApp = myAppData?.application ?? null;
  const declinedCount = myAppData?.declinedCount ?? 0;

  async function deleteGroup() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      if (res.ok) onDelisted?.(group.id);
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function openRating(characterId: string, specId: string) {
    setRatingTarget({ characterId, specId });
    setRatingSummary(null);
    setRatingLoading(true);
    apiFetch<CharacterRatingSummaryDTO>(`/api/characters/${characterId}/rating-summary`)
      .then((data) => setRatingSummary(data))
      .catch(() => setRatingSummary(null))
      .finally(() => setRatingLoading(false));
  }

  const filled: CardSlot[] = group.members.map((m) => ({
    kind: "filled",
    characterId: m.id,
    specId: m.broughtSpecId ?? m.specId,
    classId: m.classId,
    name: m.name,
    role: m.role,
  }));
  // an open slot's "accepts, in order" falls back to the desired-comps specs
  // for its role whenever the poster didn't fill per-slot prefs directly —
  // keeps the popover consistent with whatever they set in Desired comps.
  const comboPrefs = comboPrefsByRole(group.combos);
  const effectivePrefs = (s: { role: string; prefs: string[] }): string[] =>
    s.prefs.length > 0 ? s.prefs : comboPrefs[s.role] ?? [];

  const open: CardSlot[] = group.slots.map((s) => ({ kind: "open", role: s.role, prefs: effectivePrefs(s) }));
  const cardSlots = [...filled, ...open];

  return (
    <div
      id={`group-${group.id}`}
      className={cn("panel p-4 flex flex-col gap-3 relative", highlighted && "ring-2 ring-accent")}
    >
      {isOwner && (
        <div className="absolute top-3 right-3 flex gap-1.5 z-10">
          <button
            onClick={() => router.push(`/list?edit=${group.id}`)}
            title="Edit key"
            className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-xs leading-none hover:brightness-90"
          >
            ✎
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delist key"
            className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs leading-none hover:brightness-90"
          >
            🗑
          </button>
        </div>
      )}

      {/* header */}
      <div className="flex items-center gap-2 pr-16">
        {isRaid ? (
          <>
            {raid?.icon && <WowIcon slug={raid.icon} size={22} cdnSize="medium" rounded="sm" />}
            <span className="text-accent font-black text-xs uppercase tracking-wide">
              {group.raidDifficulty ? RAID_DIFFICULTY_LABEL[group.raidDifficulty as RaidDifficulty] : ""}
            </span>
            <span className="font-bold truncate">{raid?.name ?? group.raidId}</span>
            <span className="text-[11px] text-gray-500 tabular-nums">{group.members.length}/{group.raidSize}</span>
          </>
        ) : (
          <>
            <WowIcon slug={MISC_ICON.keystone} size={22} cdnSize="medium" rounded="sm" />
            <span className="text-accent font-black text-lg tabular-nums">+{group.keyLevel}</span>
            <span className="font-bold truncate">{dungeon?.name ?? group.dungeonId}</span>
          </>
        )}
        <span className="ml-auto text-sm text-gray-300 truncate max-w-[45%]">{group.title}</span>
      </div>
      <div className="flex items-center gap-2 -mt-2 text-[11px] text-gray-500">
        <span>{startInfo(group.startsAt).label}</span>
        <CountdownLight startsAt={group.startsAt} />
        {requirementLabel && (
          <span className="chip border border-panelborder text-gray-400" title="Applicant requirement (advisory only)">
            {requirementLabel}
          </span>
        )}
        {!isRaid && group.route && isConfirmedMember && (
          <button
            onClick={() => setDetailsOpen(true)}
            className="chip border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
            title="This key has a Mythic Dungeon Tools route - click Details to view"
          >
            🗺️ Route
          </button>
        )}
      </div>
      {group.description && <p className="text-xs text-gray-400 -mt-1">{group.description}</p>}

      {/* slots */}
      <div className="flex flex-wrap gap-2">
        {cardSlots.map((s, i) => (
          <SlotSquare
            key={i}
            slot={s}
            onClick={s.kind === "filled" && s.specId ? () => openRating(s.characterId, s.specId!) : undefined}
          />
        ))}
      </div>

      {group.combos.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Desired comps</div>
          <div className="flex flex-wrap gap-2">
            {group.combos.map((combo, i) => (
              <div key={i} className="flex items-center gap-1 rounded-md border border-panelborder bg-panel2/40 px-1.5 py-1">
                {combo.map((m, j) => (
                  <SpecIcon key={j} specId={m.specId} size={20} showRole={false} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && (
        <PendingRequestsModal groupId={group.id} dungeonId={group.dungeonId} onResolved={() => router.refresh()} />
      )}

      <div className="flex items-center mt-auto">
        <button
          onClick={() => setDetailsOpen(true)}
          className="chip border border-panelborder text-gray-400 hover:bg-panel2"
        >
          Details
        </button>
        {isOwner ? (
          <span className="ml-auto text-[11px] text-gray-500">Your key</span>
        ) : myApp?.status === "accepted" ? (
          <span className="ml-auto chip border border-emerald-500/50 bg-emerald-500/10 text-emerald-300">Accepted</span>
        ) : myApp?.status === "pending" ? (
          <button
            onClick={() => setApplyOpen(true)}
            className="ml-auto chip border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          >
            Applied - Pending
          </button>
        ) : myApp?.status === "declined" && declinedCount >= MAX_APPLICATION_DECLINES ? (
          <span className="ml-auto chip border border-panelborder text-gray-500" title="Declined twice for this key - no more attempts">
            Declined twice
          </span>
        ) : isFull ? (
          <span className="ml-auto chip border border-panelborder text-gray-500">Group full</span>
        ) : (
          <button
            onClick={() => setApplyOpen(true)}
            disabled={!canApply}
            title={canApply ? undefined : "Log in with Battle.net to apply"}
            className="ml-auto btn-gold px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {myApp?.status === "declined" ? "Apply again" : "Apply"}
          </button>
        )}
      </div>

      <ApplyModal
        group={group}
        current={current}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={(app) =>
          queryClient.setQueryData<MyApplicationResponse>(queryKeys.myApplication(group.id), (prev) => ({
            application: app,
            declinedCount: prev?.declinedCount ?? 0,
          }))
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delist this key?"
        message={`"${group.title}" will stop showing up anywhere. The record is kept, just hidden.`}
        confirmLabel={deleting ? "Delisting…" : "Delist"}
        onConfirm={deleteGroup}
        onCancel={() => setConfirmDelete(false)}
      />

      <CharacterRatingModal
        open={ratingTarget != null}
        onClose={() => setRatingTarget(null)}
        specId={ratingTarget?.specId ?? ""}
        forDungeonId={group.dungeonId ?? undefined}
        loading={ratingLoading}
        summary={ratingSummary}
        context={isRaid ? "raid" : "mplus"}
      />

      <GroupDetailsModal group={group} open={detailsOpen} onClose={() => setDetailsOpen(false)} viewerUserId={viewerUserId} />
    </div>
  );
}

/** Memoized: the live board replaces its `groups` array every 4s SSE tick,
 * but useLiveBoard preserves object identity for unchanged groups - so an
 * unchanged card skips re-rendering entirely instead of re-rendering N
 * cards per tick. */
export const GroupCard = memo(GroupCardInner);
