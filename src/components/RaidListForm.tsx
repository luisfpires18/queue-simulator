"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/dto";
import { type Role } from "@/game/classes";
import { RAIDS, RAID_BY_ID, RAID_DIFFICULTIES, RAID_DIFFICULTY_LABEL, raidSizeRange, type RaidDifficulty } from "@/game/raidSeason";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { RoleIcon } from "./RoleIcon";
import { ErrorModal } from "./ErrorModal";
import {
  ROLE_LABEL, ComboEditor, CoveragePanel, SlotPrefPicker, Field, UtilityCoveragePanel,
  resolveListingOwner, slotLabels, submitListingRequest, toLocalInputValue,
  useComboBuilder, useListingCoverage, type FormSlot,
} from "./GroupFormShared";
import { cn } from "@/lib/utils";

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
function raidSlotsFor(ownerRole: Role, counts: Record<Role, number>): FormSlot[] {
  const need = { ...counts };
  need[ownerRole] = Math.max(0, need[ownerRole] - 1);
  const slots: FormSlot[] = [];
  (["TANK", "HEALER", "DPS"] as Role[]).forEach((r) => {
    for (let i = 0; i < need[r]; i++) slots.push({ role: r, prefs: [] });
  });
  return slots;
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
  // navbar's currently-selected character - see resolveListingOwner.
  const { owner, ownerSpecId, ownerRole } = resolveListingOwner(current, editGroup);

  const [slots, setSlots] = useState<FormSlot[]>(
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

  const { combos, addCombo, removeCombo, addComboMember, removeComboMember, prefMode, switchPrefMode } =
    useComboBuilder(editGroup, size, setSlots);

  const {
    buffCoverage, utilityCoverage, defensiveCoverage, externalDefensiveCoverage, dispelCoverage, enemyDispelCoverage,
  } = useListingCoverage(ownerSpecId, slots, combos);

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
    const error = await submitListingRequest(editGroup, {
      kind: "raid",
      title,
      description: description.trim() || null,
      raidId, raidDifficulty: difficulty, raidSize: size, ownerRole,
      ownerCharacterId: owner.id, ownerSpecId,
      startsAt: startMode === "pick" && startAt ? new Date(startAt).toISOString() : null,
      slots: slots.map((s) => ({ role: s.role, prefs: s.prefs })),
      combos: combos.map((c) => c.members.map((m) => ({ role: m.role, specId: m.specId }))),
    });
    if (error) {
      setErr(error);
      setSubmitting(false);
      return;
    }
    window.location.assign("/raids");
  };

  const labels = slotLabels(slots);

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
                label={labels[i]}
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

      <UtilityCoveragePanel coverage={utilityCoverage} />

      <CoveragePanel title="Friendly Dispels" coverage={dispelCoverage} />
      <CoveragePanel title="Enemy Magic Dispels" coverage={enemyDispelCoverage} />
      <CoveragePanel title="Party Defensives" coverage={defensiveCoverage} />
      <CoveragePanel title="External Defensives" coverage={externalDefensiveCoverage} />

      <div className="flex items-center gap-3">
        <Link href="/raids" className="btn-ghost">
          ← Go back
        </Link>
        <button onClick={submit} disabled={submitting || !compValid} className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed">
          {editGroup ? (submitting ? "Saving…" : "Save changes") : (submitting ? "Listing…" : "List raid")}
        </button>
      </div>

      <ErrorModal
        open={err != null}
        title={editGroup ? "Couldn't save changes" : "Couldn't list your raid"}
        message={err ?? ""}
        onClose={() => setErr(null)}
      />
    </div>
  );
}
