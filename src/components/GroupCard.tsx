"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationDTO, CharacterRatingSummaryDTO, ComboMember, CurrentSelectionDTO, GroupDTO } from "@/data/source";
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
import { ConfirmDialog } from "./ConfirmDialog";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
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

/** Compact label for the optional applicant-requirement chip - advisory
 * only, see src/game/achievements.ts. */
function requirementChipLabel(group: GroupDTO): string | null {
  switch (group.requirementType) {
    case "rating":
      return group.reqRating != null ? `${group.reqRating}+ rating` : null;
    case "resilient":
      return group.reqLevel != null ? `Resilient +${group.reqLevel}` : null;
    case "custom":
      return group.reqLevel != null && group.reqExtraCount != null && group.reqExtraLevel != null
        ? `Resilient +${group.reqLevel} · ${group.reqExtraCount}×${group.reqExtraLevel}`
        : null;
    default:
      return null;
  }
}

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };
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
      <span className="text-[10px] text-gray-500">{ROLE_LABEL[slot.role] ?? "open"}</span>

      {/* hover popover: full ordered accepted specs, in full colour */}
      {slot.prefs.length > 0 && (
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-44 panel p-2 shadow-card">
          <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">
            {ROLE_LABEL[slot.role]} - accepts, in order
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

function formatStart(startsAt: string | null): string {
  if (!startsAt) return "Forming now";
  const d = new Date(startsAt);
  return `Starts ${d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

export function GroupCard({
  group, current, canApply, viewerUserId,
}: {
  group: GroupDTO;
  current: CurrentSelectionDTO | null;
  canApply: boolean;
  viewerUserId: string | null;
}) {
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myApp, setMyApp] = useState<ApplicationDTO | null>(null);
  const [declinedCount, setDeclinedCount] = useState(0);
  const [ratingTarget, setRatingTarget] = useState<{ characterId: string; specId: string } | null>(null);
  const [ratingSummary, setRatingSummary] = useState<CharacterRatingSummaryDTO | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const isOwner = viewerUserId != null && viewerUserId === group.ownerUserId;
  const isFull = group.slots.length === 0;
  const isRaid = group.kind === "raid";
  const dungeon = group.dungeonId ? DUNGEON_BY_ID[group.dungeonId] : undefined;
  const raid = group.raidId ? RAID_BY_ID[group.raidId] : undefined;
  const requirementLabel = requirementChipLabel(group);

  useEffect(() => {
    if (isOwner || !canApply) return;
    fetch(`/api/groups/${group.id}/my-application`)
      .then((r) => r.json())
      .then((data) => {
        setMyApp(data.application ?? null);
        setDeclinedCount(data.declinedCount ?? 0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, isOwner, canApply]);

  async function deleteGroup() {
    setDeleting(true);
    try {
      await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
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
    fetch(`/api/characters/${characterId}/rating-summary`)
      .then((r) => (r.ok ? r.json() : null))
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
    <div className="panel p-4 flex flex-col gap-3 relative">
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
        <span>{formatStart(group.startsAt)}</span>
        {requirementLabel && (
          <span className="chip border border-panelborder text-gray-400" title="Applicant requirement (advisory only)">
            {requirementLabel}
          </span>
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
        onApplied={(app) => setMyApp(app)}
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
      />
    </div>
  );
}
