"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/source";
import { specById, type Role } from "@/game/classes";
import { RAIDS, RAID_BY_ID, RAID_DIFFICULTIES, RAID_DIFFICULTY_LABEL, raidSizeRange, type RaidDifficulty } from "@/game/raidSeason";
import {
  computeBuffCoverage, computeUtilityCoverage, computeDefensiveCoverage, computeExternalDefensiveCoverage,
  computeDispelCoverage, computeEnemyDispelCoverage,
} from "@/game/coverage";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { RoleIcon } from "./RoleIcon";
import {
  ROLE_LABEL, ComboEditor, CoveragePanel, CoverageCol, SlotPrefPicker, Field, type ComboMember,
} from "./GroupFormShared";
import { cn } from "@/lib/utils";

interface Slot { role: Role; prefs: string[] }

/** Sane default split for a given roster size - always sums to `size` by
 * construction (DPS is the remainder), floors tanks/healers at 2 each so
 * small flex rosters don't suggest zero of either. Fully editable afterward -
 * this is just a starting point, not a formula the owner is locked into. */
function suggestComp(size: number): Record<Role, number> {
  const TANK = Math.max(2, Math.round(size * 0.1));
  const HEALER = Math.max(2, Math.round(size * 0.2));
  const DPS = Math.max(0, size - TANK - HEALER);
  return { TANK, HEALER, DPS };
}

// remaining slots after the owner's own role is accounted for
function raidSlotsFor(ownerRole: Role, counts: Record<Role, number>): Slot[] {
  const need = { ...counts };
  need[ownerRole] = Math.max(0, need[ownerRole] - 1);
  const slots: Slot[] = [];
  (["TANK", "HEALER", "DPS"] as Role[]).forEach((r) => {
    for (let i = 0; i < need[r]; i++) slots.push({ role: r, prefs: [] });
  });
  return slots;
}

let comboSeq = 0;

/** ISO string -> the local value a <input type="datetime-local"> expects. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RaidListForm({
  current, editGroup,
}: {
  current: CurrentSelectionDTO;
  editGroup?: GroupDTO | null;
}) {
  const [raidId, setRaidId] = useState(editGroup?.raidId ?? RAIDS[0].id);
  const [difficulty, setDifficulty] = useState<RaidDifficulty>((editGroup?.raidDifficulty as RaidDifficulty) ?? "heroic");
  const range = raidSizeRange(raidId, difficulty);

  // Owner-editable tank/healer/dps counts - free write-boxes, no upper bound.
  // Roster size is just whatever the three add up to, EXCEPT a fixed-Mythic
  // raid (locked to exactly 20 by the game itself, not a UI choice) - that's
  // the one real constraint enforced below.
  const [compDirty, setCompDirty] = useState(Boolean(editGroup));
  const [counts, setCounts] = useState<Record<Role, number>>(() =>
    editGroup
      ? (() => {
          const c: Record<Role, number> = { TANK: 0, HEALER: 0, DPS: 0 };
          for (const m of editGroup.members) c[m.role as Role] = (c[m.role as Role] ?? 0) + 1;
          for (const s of editGroup.slots) c[s.role as Role] = (c[s.role as Role] ?? 0) + 1;
          return c;
        })()
      : suggestComp(range.max)
  );

  useEffect(() => {
    if (!compDirty) setCounts(suggestComp(range.max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raidId, difficulty]);

  const setCount = (role: Role, v: number) => {
    setCompDirty(true);
    setCounts((prev) => ({ ...prev, [role]: Math.max(0, Number.isFinite(v) ? v : 0) }));
  };

  const size = counts.TANK + counts.HEALER + counts.DPS;
  const compValid = range.fixed ? size === range.max : true;

  const title = `${RAID_DIFFICULTY_LABEL[difficulty]} ${RAID_BY_ID[raidId]?.name ?? ""}`;

  const [description, setDescription] = useState(editGroup?.description ?? "");
  const [startMode, setStartMode] = useState<"now" | "pick">(editGroup?.startsAt ? "pick" : "now");
  const [startAt, setStartAt] = useState(editGroup?.startsAt ? toLocalInputValue(editGroup.startsAt) : "");

  // Fixed to this raid's original owner/spec (slot 0) when editing, not the
  // navbar's currently-selected character - see the identical fix/comment in
  // ListKeyForm.tsx.
  const editOwnerMember = editGroup?.members.find((m) => m.slot === 0) ?? null;
  const owner = editOwnerMember ?? current.character;
  const ownerSpecId = editOwnerMember?.broughtSpecId ?? current.specId;
  const ownerRole = (specById(ownerSpecId)?.role ?? "DPS") as Role;

  const [slots, setSlots] = useState<Slot[]>(
    () => editGroup?.slots.map((s) => ({ role: s.role as Role, prefs: s.prefs })) ?? raidSlotsFor(ownerRole, counts)
  );
  // rebuild open slots whenever the comp counts or the owner's role change -
  // not on mount, so loading an existing raid's slots (edit mode) isn't clobbered.
  const prevKey = useRef(`${ownerRole}:${counts.TANK}:${counts.HEALER}:${counts.DPS}`);
  useEffect(() => {
    const key = `${ownerRole}:${counts.TANK}:${counts.HEALER}:${counts.DPS}`;
    if (prevKey.current === key) return;
    prevKey.current = key;
    setSlots(raidSlotsFor(ownerRole, counts));
  }, [ownerRole, counts]);

  const setSlotPrefs = (i: number, prefs: string[]) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, prefs } : s)));

  const [combos, setCombos] = useState<{ key: number; members: ComboMember[] }[]>(
    () => editGroup?.combos.map((combo) => ({ key: comboSeq++, members: combo.map((m) => ({ role: m.role as Role, specId: m.specId })) })) ?? []
  );
  const addCombo = () => setCombos((prev) => [...prev, { key: comboSeq++, members: [] }]);
  const removeCombo = (key: number) => setCombos((prev) => prev.filter((c) => c.key !== key));
  const addComboMember = (key: number, specId: string) => {
    const role = specById(specId)!.role as Role;
    setCombos((prev) =>
      prev.map((c) =>
        c.key === key && c.members.length < size
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

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!ownerSpecId) { setErr("Pick a spec to play."); return; }
    if (!compValid) { setErr(`This raid's Mythic needs exactly ${range.max} (currently ${size}).`); return; }
    if (prefMode === "combo") {
      const badCombo = combos.find((c) => c.members.length < 2);
      if (badCombo) { setErr("A combo needs at least 2 members (or remove it)."); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch(editGroup ? `/api/groups/${editGroup.id}` : "/api/groups", {
        method: editGroup ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "raid",
          title,
          description: description.trim() || null,
          raidId, raidDifficulty: difficulty, raidSize: size, ownerRole,
          ownerCharacterId: owner.id, ownerSpecId,
          startsAt: startMode === "pick" && startAt ? new Date(startAt).toISOString() : null,
          slots: slots.map((s) => ({ role: s.role, prefs: s.prefs })),
          combos: combos.map((c) => c.members.map((m) => ({ role: m.role, specId: m.specId }))),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const action = editGroup ? "Update" : "List";
        setErr(res.status === 401 ? "Session expired - log in again." : `${action} failed (${res.status}). ${body.slice(0, 140)}`);
        setSubmitting(false);
        return;
      }
      window.location.assign("/raids");
    } catch (e) {
      setErr(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
      setSubmitting(false);
    }
  };

  const dpsIndex: number[] = [];
  let d = 0;
  slots.forEach((s) => dpsIndex.push(s.role === "DPS" ? ++d : 0));
  const dpsTotal = slots.filter((s) => s.role === "DPS").length;

  return (
    <div className="space-y-6">
      <div className="panel p-4 space-y-4">
        <Field label="Title">
          <div className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm text-gray-200">
            {title}
          </div>
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm resize-none"
          />
        </Field>

        <Field label="Raid">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RAIDS.map((r) => (
              <button
                key={r.id} onClick={() => setRaidId(r.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-2 text-left",
                  raidId === r.id ? "bg-accent/15 border-accent" : "border-panelborder hover:bg-panel2"
                )}
              >
                {r.icon && <WowIcon slug={r.icon} size={32} rounded="sm" title={r.name} />}
                <div className="min-w-0">
                  <div className={cn("text-xs font-semibold", raidId === r.id ? "text-accent" : "text-gray-300")}>{r.abbr}</div>
                  <div className="text-[9px] font-normal opacity-70 truncate">{r.name}</div>
                </div>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Difficulty">
          <div className="flex gap-2">
            {RAID_DIFFICULTIES.map((diff) => (
              <button
                key={diff} onClick={() => setDifficulty(diff)}
                className={cn("chip border", difficulty === diff ? "border-accent text-accent" : "border-panelborder text-gray-400")}
              >
                {RAID_DIFFICULTY_LABEL[diff]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Starting">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStartMode("now")}
              className={cn("chip border", startMode === "now" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
            >
              Right now
            </button>
            <button
              onClick={() => setStartMode("pick")}
              className={cn("chip border", startMode === "pick" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
            >
              Pick a time
            </button>
            {startMode === "pick" && (
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-sm"
              />
            )}
          </div>
        </Field>
      </div>

      {/* who you're listing as: set globally via the navbar picker */}
      <div className="panel p-4 flex items-center gap-3">
        <SpecIcon specId={ownerSpecId} size={40} />
        <div>
          <div className="text-sm font-semibold">{owner.name} <span className="text-gray-500 text-xs">- {owner.realm}</span></div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            Fills the
            <RoleIcon role={ownerRole} size={14} rounded="sm" />
            <span className="text-gray-300 font-semibold">{ROLE_LABEL[ownerRole]}</span> slot.
          </p>
        </div>
        <p className="ml-auto text-[11px] text-gray-500">
          {editGroup ? "This raid's original character - not editable here." : "Change character in the navbar picker ↑"}
        </p>
      </div>

      {/* comp: freely typed tank/healer/dps counts, no upper bound - roster
          size is just whatever the three add up to, except a fixed-Mythic
          raid (a real game rule: exactly 20, not a UI choice). */}
      <div className="panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comp</div>
          <span className={cn("text-[11px] tabular-nums", compValid ? "text-emerald-400" : "text-rose-400")}>
            {size} total{range.fixed ? ` / ${range.max} required` : ""}
          </span>
          {!compDirty && <span className="text-[10px] text-gray-600">(suggested split - edit freely)</span>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["TANK", "HEALER", "DPS"] as Role[]).map((role) => (
            <div key={role} className="flex items-center gap-2">
              <RoleIcon role={role} size={16} rounded="sm" />
              <span className="text-xs text-gray-300 flex-1">{ROLE_LABEL[role]}</span>
              <input
                type="number"
                min={0}
                value={counts[role]}
                onChange={(e) => setCount(role, parseInt(e.target.value, 10))}
                className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1 text-sm text-center tabular-nums"
              />
            </div>
          ))}
        </div>
        {range.fixed && !compValid && (
          <p className="text-[11px] text-rose-400">This raid's Mythic is a fixed {range.max}-player roster - the three counts must add up to exactly {range.max}.</p>
        )}
      </div>

      {/* per-slot prefs vs desired comps are mutually exclusive - pick one */}
      <div className="flex gap-2">
        <button
          onClick={() => switchPrefMode("slots")}
          className={cn("chip border", prefMode === "slots" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
        >
          Per-slot preferences
        </button>
        <button
          onClick={() => switchPrefMode("combo")}
          className={cn("chip border", prefMode === "combo" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
        >
          Desired comps
        </button>
      </div>

      {prefMode === "slots" ? (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Open slots ({slots.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {slots.map((s, i) => (
              <SlotPrefPicker
                key={i}
                role={s.role}
                label={s.role === "DPS" && dpsTotal > 1 ? `DPS #${dpsIndex[i]}` : ROLE_LABEL[s.role]}
                value={s.prefs}
                onChange={(v) => setSlotPrefs(i, v)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Desired comps</label>
            <span className="text-[11px] text-gray-600">Bring your own core - up to {size} specs as a bundle (your tank/healer/dps counts above)</span>
          </div>
          {combos.map((combo) => (
            <ComboEditor
              key={combo.key}
              members={combo.members}
              ownerSpecId={ownerSpecId}
              maxMembers={size}
              onAdd={(specId) => addComboMember(combo.key, specId)}
              onRemove={(i) => removeComboMember(combo.key, i)}
              onDelete={() => removeCombo(combo.key)}
            />
          ))}
          <button onClick={addCombo} className="btn-ghost text-xs px-3 py-1.5">+ Add a combo</button>
        </div>
      )}

      <CoveragePanel title="Buffs & Debuffs" coverage={buffCoverage} />

      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Utility</div>
          {utilityCoverage.warning && (
            <div className="chip bg-rose-500/15 border border-rose-500/50 text-rose-200">
              ⚠ Missing {utilityCoverage.lust === "missing" ? "Bloodlust" : ""}
              {utilityCoverage.lust === "missing" && utilityCoverage.res === "missing" ? " & " : ""}
              {utilityCoverage.res === "missing" ? "Battle Res" : ""}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CoverageCol title="Have" items={utilityCoverage.have} status="have" />
          <CoverageCol title="Want" items={utilityCoverage.want} status="want" />
          <CoverageCol title="Missing" items={utilityCoverage.missing} status="missing" />
        </div>
      </div>

      <CoveragePanel title="Friendly Dispels" coverage={dispelCoverage} />
      <CoveragePanel title="Enemy Magic Dispels" coverage={enemyDispelCoverage} />
      <CoveragePanel title="Party Defensives" coverage={defensiveCoverage} />
      <CoveragePanel title="External Defensives" coverage={externalDefensiveCoverage} />

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <button onClick={submit} disabled={submitting || !compValid} className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed">
        {editGroup ? (submitting ? "Saving…" : "Save changes") : (submitting ? "Listing…" : "List raid")}
      </button>
    </div>
  );
}
