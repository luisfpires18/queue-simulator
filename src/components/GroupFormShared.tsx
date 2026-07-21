"use client";

import { useMemo, useState } from "react";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/dto";
import { ALL_SPECS, specById, isRangedDps, CLASS_BY_ID, type Role } from "@/game/classes";
import {
  computeBuffCoverage, computeUtilityCoverage, computeDefensiveCoverage, computeExternalDefensiveCoverage,
  computeDispelCoverage, computeEnemyDispelCoverage, computeSkipCoverage,
  type CoverageItem, type CoverageStatus,
} from "@/game/coverage";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { RoleIcon } from "./RoleIcon";
import { cn } from "@/lib/utils";

// Pieces shared by ListKeyForm.tsx (M+) and RaidListForm.tsx (raid) — every
// bit of the "list a group" UI that's purely role/spec-driven, with zero
// coupling to dungeons or raids. Moved verbatim out of ListKeyForm.tsx (same
// code, same behavior) so the two forms don't duplicate ~300 lines.

export const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export const SPECS_BY_ROLE: Record<Role, typeof ALL_SPECS> = {
  TANK: ALL_SPECS.filter((s) => s.role === "TANK"),
  HEALER: ALL_SPECS.filter((s) => s.role === "HEALER"),
  DPS: ALL_SPECS.filter((s) => s.role === "DPS"),
};

export interface ComboMember { role: Role; specId: string }

export interface FormSlot { role: Role; prefs: string[] }

/** ISO string -> the local value a <input type="datetime-local"> expects. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Who you're listing as": the navbar's current character/spec for a NEW
 * listing, but a group being EDITED keeps its own owner/spec (slot 0) fixed
 * at listing time - editing must not silently reassign the listing to
 * whatever character happens to be selected in the navbar right now. */
export function resolveListingOwner(current: CurrentSelectionDTO, editGroup: GroupDTO | null | undefined) {
  const editOwnerMember = editGroup?.members.find((m) => m.slot === 0) ?? null;
  const owner = editOwnerMember ?? current.character;
  const ownerSpecId = editOwnerMember?.broughtSpecId ?? current.specId;
  const ownerRole = (specById(ownerSpecId)?.role ?? "DPS") as Role;
  return { editOwnerMember, owner, ownerSpecId, ownerRole };
}

let comboSeq = 0;

export interface ComboDraft { key: number; members: ComboMember[] }

/** The desired-comps builder state shared verbatim by both listing forms:
 * combo add/remove/edit plus the per-slot-prefs vs. combos mode toggle
 * (mutually exclusive ways of expressing what the group wants - picking one
 * clears the other). `maxMembers` is read at call time, so a raid form
 * whose roster size changes keeps enforcing the current cap. */
export function useComboBuilder(
  editGroup: GroupDTO | null | undefined,
  maxMembers: number,
  setSlots: React.Dispatch<React.SetStateAction<FormSlot[]>>
) {
  const [combos, setCombos] = useState<ComboDraft[]>(
    () => editGroup?.combos.map((combo) => ({ key: comboSeq++, members: combo.map((m) => ({ role: m.role as Role, specId: m.specId })) })) ?? []
  );
  const addCombo = () => setCombos((prev) => [...prev, { key: comboSeq++, members: [] }]);
  const removeCombo = (key: number) => setCombos((prev) => prev.filter((c) => c.key !== key));
  const addComboMember = (key: number, specId: string) => {
    const role = specById(specId)!.role as Role;
    setCombos((prev) =>
      prev.map((c) =>
        c.key === key && c.members.length < maxMembers
          ? { ...c, members: [...c.members, { role, specId }] }
          : c
      )
    );
  };
  const removeComboMember = (key: number, i: number) =>
    setCombos((prev) => prev.map((c) => (c.key === key ? { ...c, members: c.members.filter((_, j) => j !== i) } : c)));

  const [prefMode, setPrefMode] = useState<"slots" | "combo">(
    () => (editGroup?.combos.length ? "combo" : "slots")
  );
  const switchPrefMode = (mode: "slots" | "combo") => {
    if (mode === prefMode) return;
    if (mode === "slots") setCombos([]);
    else setSlots((prev) => prev.map((s) => ({ ...s, prefs: [] })));
    setPrefMode(mode);
  };

  return { combos, addCombo, removeCombo, addComboMember, removeComboMember, prefMode, switchPrefMode };
}

/** HAVE = the listing owner (actual). WANT = every spec listed as
 * acceptable, across all ranked slot prefs and desired-comp members
 * (whichever mode is active). The coverage panels both forms render. */
export function useListingCoverage(ownerSpecId: string, slots: FormSlot[], combos: ComboDraft[]) {
  const desiredSpecIds = useMemo(
    () => [
      ...slots.flatMap((s) => s.prefs),
      ...combos.flatMap((c) => c.members.map((m) => m.specId)),
    ],
    [slots, combos]
  );
  const buffCoverage = useMemo(() => computeBuffCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  const utilityCoverage = useMemo(() => computeUtilityCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  const defensiveCoverage = useMemo(() => computeDefensiveCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  const externalDefensiveCoverage = useMemo(() => computeExternalDefensiveCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  const dispelCoverage = useMemo(() => computeDispelCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  const enemyDispelCoverage = useMemo(() => computeEnemyDispelCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  const skipCoverage = useMemo(() => computeSkipCoverage([ownerSpecId], desiredSpecIds), [ownerSpecId, desiredSpecIds]);
  return { buffCoverage, utilityCoverage, defensiveCoverage, externalDefensiveCoverage, dispelCoverage, enemyDispelCoverage, skipCoverage };
}

/** DPS slots labeled "DPS #1/#2/#3" when there's more than one; other roles
 * (and a lone DPS slot) keep the plain role label. */
export function slotLabels(slots: FormSlot[]): string[] {
  const dpsTotal = slots.filter((s) => s.role === "DPS").length;
  let d = 0;
  return slots.map((s) => (s.role === "DPS" && dpsTotal > 1 ? `DPS #${++d}` : ROLE_LABEL[s.role]));
}

/** POST/PATCH a listing to /api/groups[/id]. Returns the user-facing error
 * string on failure, or null on success (caller navigates away). */
export async function submitListingRequest(editGroup: GroupDTO | null | undefined, payload: unknown): Promise<string | null> {
  try {
    const res = await fetch(editGroup ? `/api/groups/${editGroup.id}` : "/api/groups", {
      method: editGroup ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const parsedError = (() => {
        try { return JSON.parse(body).error as string | undefined; } catch { return undefined; }
      })();
      const action = editGroup ? "Update" : "List";
      return res.status === 401
        ? "Session expired - log in again."
        : parsedError ?? `${action} failed (${res.status}). ${body.slice(0, 140)}`;
    }
    return null;
  } catch (e) {
    return `Network error: ${e instanceof Error ? e.message : "unknown"}`;
  }
}

/** The Utility coverage panel (lust/res warning chip + have/want/missing
 * columns) rendered identically by both forms and GroupDetailsModal. */
export function UtilityCoveragePanel({ coverage }: { coverage: ReturnType<typeof computeUtilityCoverage> }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Utility</div>
        {coverage.warning && (
          <div className="chip bg-rose-500/15 border border-rose-500/50 text-rose-200">
            ⚠ Missing {coverage.lust === "missing" ? "Bloodlust" : ""}
            {coverage.lust === "missing" && coverage.res === "missing" ? " & " : ""}
            {coverage.res === "missing" ? "Battle Res" : ""}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <CoverageCol title="Have" items={coverage.have} status="have" />
        <CoverageCol title="Want" items={coverage.want} status="want" />
        <CoverageCol title="Missing" items={coverage.missing} status="missing" />
      </div>
    </div>
  );
}

export function ComboEditor({
  members, ownerSpecId, maxMembers = 4, onAdd, onRemove, onDelete,
}: {
  members: ComboMember[];
  ownerSpecId: string;
  /** M+ combos cap at a duo/trio/quartet (4); raid combos allow a bigger "bring your core" bundle. */
  maxMembers?: number;
  onAdd: (specId: string) => void;
  onRemove: (i: number) => void;
  onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [pickRole, setPickRole] = useState<Role>("DPS");

  return (
    <div className="rounded-lg border border-panelborder bg-panel2/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500">{members.length}/{maxMembers} members</span>
        <button onClick={onDelete} className="ml-auto text-gray-500 hover:text-rose-400 text-xs">Remove combo ✕</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {members.map((m, i) => {
          const sp = specById(m.specId)!;
          const cls = CLASS_BY_ID[sp.classId];
          return (
            <div key={i} className="flex items-center gap-1.5 rounded-md border border-panelborder bg-panel px-2 py-1">
              <SpecIcon specId={m.specId} size={32} />
              <span className="text-xs leading-tight" style={{ color: cls.color }}>{sp.name}</span>
              <button onClick={() => onRemove(i)} className="text-gray-500 hover:text-rose-400 text-xs ml-1">✕</button>
            </div>
          );
        })}
        {members.length < maxMembers && (
          <button
            onClick={() => setPicking((v) => !v)}
            className="rounded-md border border-dashed border-panelborder hover:border-gold/60 px-3 py-1 text-xs text-gray-400"
          >
            + Add spec
          </button>
        )}
      </div>
      {picking && (
        <div className="pt-2 border-t border-panelborder/60 space-y-2">
          <div className="flex gap-1.5">
            {(["TANK", "HEALER", "DPS"] as Role[]).map((r) => (
              <button
                key={r} onClick={() => setPickRole(r)}
                className={cn(
                  "chip border text-[11px]",
                  pickRole === r ? "border-gold text-white bg-panel2" : "border-panelborder text-gray-400"
                )}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto">
            <SpecPickButtons
              specs={SPECS_BY_ROLE[pickRole].filter((sp) => sp.id !== ownerSpecId)}
              size={28}
              onPick={(specId) => { onAdd(specId); if (members.length + 1 >= maxMembers) setPicking(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** DPS specs split into Melee/Ranged sub-groups; other roles render as one flat row. */
export function SpecPickButtons({
  specs, size, onPick,
}: {
  specs: typeof ALL_SPECS;
  size: number;
  onPick: (specId: string) => void;
}) {
  const isDps = specs.length > 0 && specs[0].role === "DPS";
  if (!isDps) {
    return (
      <div className="flex flex-wrap gap-1">
        {specs.map((sp) => (
          <SpecPickButton key={sp.id} spec={sp} size={size} onPick={onPick} />
        ))}
      </div>
    );
  }
  const melee = specs.filter((sp) => !isRangedDps(sp.id));
  const ranged = specs.filter((sp) => isRangedDps(sp.id));
  return (
    <div className="space-y-1.5">
      <div>
        <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Melee</div>
        <div className="flex flex-wrap gap-1">
          {melee.map((sp) => (
            <SpecPickButton key={sp.id} spec={sp} size={size} onPick={onPick} />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Ranged</div>
        <div className="flex flex-wrap gap-1">
          {ranged.map((sp) => (
            <SpecPickButton key={sp.id} spec={sp} size={size} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SpecPickButton({
  spec, size, onPick,
}: {
  spec: typeof ALL_SPECS[number];
  size: number;
  onPick: (specId: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(spec.id)}
      className="flex items-center gap-1.5 rounded-md border border-panelborder hover:border-gold/60 pr-2 pl-1 py-1"
      title={`${spec.name} ${CLASS_BY_ID[spec.classId].name}`}
    >
      <SpecIcon specId={spec.id} size={size} showRole={false} />
      <span className="text-xs" style={{ color: CLASS_BY_ID[spec.classId].color }}>{spec.name}</span>
    </button>
  );
}

/** Always-open panel variant of CoverageSection (which is collapsible) —
 * used for the always-visible sections on the listing form itself. */
export function CoveragePanel({
  title, coverage,
}: {
  title: string;
  coverage: { have: CoverageItem[]; want: CoverageItem[]; missing: CoverageItem[] };
}) {
  return (
    <div className="panel p-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</div>
      <div className="grid grid-cols-3 gap-4">
        <CoverageCol title="Have" items={coverage.have} status="have" />
        <CoverageCol title="Want" items={coverage.want} status="want" />
        <CoverageCol title="Missing" items={coverage.missing} status="missing" />
      </div>
    </div>
  );
}

export function CoverageCol({
  title, items, status,
}: {
  title: string;
  items: CoverageItem[];
  status: CoverageStatus;
}) {
  const titleColor = status === "have" ? "text-emerald-400" : status === "want" ? "text-amber-400" : "text-gray-500";
  const chipClass = (critical: boolean) =>
    status === "have"
      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
      : status === "want"
      ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
      : critical
      ? "bg-rose-500/10 border-rose-500/40 text-rose-200"
      : "bg-panel2 border-panelborder text-gray-500";
  return (
    <div>
      <div className={cn("text-xs font-semibold uppercase tracking-wide mb-2", titleColor)}>{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-600">-</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it.id}
              className={cn("chip border", chipClass(it.critical))}
              title={it.requiresTalent ? `${it.description ?? it.label} — requires this player to have the talent selected; not guaranteed just by spec.` : it.description ?? it.label}
            >
              <WowIcon
                slug={it.iconSlug}
                size={14}
                cdnSize="small"
                rounded="sm"
                fallbackColor={it.fallbackColor}
                className={status === "missing" ? "grayscale opacity-70" : undefined}
              />
              {it.label}
              {it.requiresTalent && <span className="text-amber-300" title="Requires talent">⚠</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SlotPrefPicker({
  role, label, value, onChange,
}: {
  role: Role; label: string; value: string[]; onChange: (v: string[]) => void;
}) {
  const pool = SPECS_BY_ROLE[role];
  const add = (id: string) => { if (!value.includes(id)) onChange([...value, id]); };
  const remove = (id: string) => onChange(value.filter((x) => x !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <RoleIcon role={role} size={14} rounded="sm" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-gray-600 ml-auto">any of (in order)</span>
      </div>

      {value.length > 0 && (
        <ol className="space-y-1">
          {value.map((id, i) => {
            const sp = specById(id)!;
            const cls = CLASS_BY_ID[sp.classId];
            return (
              <li key={id} className="flex items-center gap-2 bg-panel2 border border-panelborder rounded-md px-2 py-1">
                <span className="text-[10px] text-gray-500 w-3">{i + 1}</span>
                <SpecIcon specId={id} size={32} />
                <span className="text-xs flex-1 truncate" style={{ color: cls?.color }}>{sp.name}</span>
                <button onClick={() => move(i, -1)} className="text-gray-500 hover:text-white text-xs">▲</button>
                <button onClick={() => move(i, 1)} className="text-gray-500 hover:text-white text-xs">▼</button>
                <button onClick={() => remove(id)} className="text-gray-500 hover:text-rose-400 text-xs">✕</button>
              </li>
            );
          })}
        </ol>
      )}

      <SpecIconGroups specs={pool.filter((s) => !value.includes(s.id))} onPick={add} />
    </div>
  );
}

/** DPS specs split into Melee/Ranged sub-groups (icon-only buttons); other roles render as one flat row. */
function SpecIconGroups({
  specs, onPick,
}: {
  specs: typeof ALL_SPECS;
  onPick: (specId: string) => void;
}) {
  const isDps = specs.length > 0 && specs[0].role === "DPS";
  if (!isDps) return <SpecIconRow specs={specs} onPick={onPick} />;
  const melee = specs.filter((sp) => !isRangedDps(sp.id));
  const ranged = specs.filter((sp) => isRangedDps(sp.id));
  return (
    <div className="space-y-1.5">
      <div>
        <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Melee</div>
        <SpecIconRow specs={melee} onPick={onPick} />
      </div>
      <div>
        <div className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Ranged</div>
        <SpecIconRow specs={ranged} onPick={onPick} />
      </div>
    </div>
  );
}

function SpecIconRow({
  specs, onPick,
}: {
  specs: typeof ALL_SPECS;
  onPick: (specId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {specs.map((s) => (
        <button
          key={s.id} onClick={() => onPick(s.id)}
          className="rounded-md border border-panelborder hover:border-gold/60 p-0.5"
          title={`${s.name} ${CLASS_BY_ID[s.classId].name}`}
        >
          <SpecIcon specId={s.id} size={32} showRole={false} />
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
