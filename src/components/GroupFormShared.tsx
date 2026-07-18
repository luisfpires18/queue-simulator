"use client";

import { useState } from "react";
import { ALL_SPECS, specById, isRangedDps, CLASS_BY_ID, type Role } from "@/game/classes";
import { type CoverageItem, type CoverageStatus } from "@/game/coverage";
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
