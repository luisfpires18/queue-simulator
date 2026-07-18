"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/source";
import { specById, type Role } from "@/game/classes";
import { DUNGEONS, DUNGEON_BY_ID } from "@/game/season";
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

const MIN_KEY = 2;
const MAX_KEY = 25;

interface Slot { role: Role; prefs: string[] }

// remaining slots to complete 1 tank / 1 healer / 3 dps after the owner's role
function openSlotsFor(ownerRole: Role): Slot[] {
  const need: Record<Role, number> = { TANK: 1, HEALER: 1, DPS: 3 };
  need[ownerRole] -= 1;
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

export function ListKeyForm({
  current, editGroup,
}: {
  current: CurrentSelectionDTO;
  editGroup?: GroupDTO | null;
}) {
  const [dungeonId, setDungeonId] = useState(editGroup?.dungeonId ?? DUNGEONS[0].id);
  const [keyLevel, setKeyLevel] = useState(editGroup?.keyLevel ?? 20);

  // Applicant requirement (optional, advisory only - see src/game/achievements.ts):
  // a skill bar shown on the listing, and as a meets/doesn't-meet badge next
  // to each applicant. Never blocks /apply, purely informational.
  const [requirementType, setRequirementType] = useState<"none" | "rating" | "resilient" | "custom">(
    (editGroup?.requirementType as "rating" | "resilient" | "custom" | null) ?? "none"
  );
  const [reqRating, setReqRating] = useState(editGroup?.reqRating ?? 3000);
  const [reqLevel, setReqLevel] = useState(editGroup?.reqLevel ?? 21);
  const [reqExtraCount, setReqExtraCount] = useState(editGroup?.reqExtraCount ?? 1);
  const [reqExtraLevel, setReqExtraLevel] = useState(editGroup?.reqExtraLevel ?? 22);

  // title is always derived from dungeon + key level — no manual editing.
  const title = `+${keyLevel} ${DUNGEON_BY_ID[dungeonId]?.name ?? ""}`;

  const [description, setDescription] = useState(editGroup?.description ?? "");

  const [startMode, setStartMode] = useState<"now" | "pick">(editGroup?.startsAt ? "pick" : "now");
  const [startAt, setStartAt] = useState(editGroup?.startsAt ? toLocalInputValue(editGroup.startsAt) : "");

  // Who you're listing as — set globally via the navbar's current-character
  // picker when LISTING a new key, but a key you're EDITING already has its
  // own owner/spec (slot 0) fixed at listing time. Editing must keep using
  // that, not silently reassign the key to whatever character/spec happens
  // to be selected in the navbar right now (e.g. you listed with an alt,
  // then switched your navbar character to your main before opening Edit).
  const editOwnerMember = editGroup?.members.find((m) => m.slot === 0) ?? null;
  const owner = editOwnerMember ?? current.character;
  const ownerSpecId = editOwnerMember?.broughtSpecId ?? current.specId;
  const ownerRole = (specById(ownerSpecId)?.role ?? "DPS") as Role;

  // open slots rebuild only when the owner's role actually changes (e.g. the
  // navbar character picker switches spec) — not on mount, so loading an
  // existing key's slots (edit mode) doesn't get clobbered. Comparing against
  // the last-seen role (rather than a "have we run yet" flag) keeps this safe
  // under React Strict Mode's dev double-invoke of effects.
  const [slots, setSlots] = useState<Slot[]>(
    () => editGroup?.slots.map((s) => ({ role: s.role as Role, prefs: s.prefs })) ?? openSlotsFor(ownerRole)
  );
  const prevOwnerRole = useRef(ownerRole);
  useEffect(() => {
    if (prevOwnerRole.current === ownerRole) return;
    prevOwnerRole.current = ownerRole;
    setSlots(openSlotsFor(ownerRole));
  }, [ownerRole]);

  const setSlotPrefs = (i: number, prefs: string[]) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, prefs } : s)));

  // ---- pre-made-group combos (2-4 members, an alternative to per-slot picks) ----
  // A desired comp is a bundle of specs (not your own characters) — e.g. a
  // known-good trio you'd want to see show up together in one group.
  const [combos, setCombos] = useState<{ key: number; members: ComboMember[] }[]>(
    () => editGroup?.combos.map((combo) => ({ key: comboSeq++, members: combo.map((m) => ({ role: m.role as Role, specId: m.specId })) })) ?? []
  );
  const addCombo = () => setCombos((prev) => [...prev, { key: comboSeq++, members: [] }]);
  const removeCombo = (key: number) => setCombos((prev) => prev.filter((c) => c.key !== key));
  const addComboMember = (key: number, specId: string) => {
    const role = specById(specId)!.role as Role;
    setCombos((prev) =>
      prev.map((c) =>
        c.key === key && c.members.length < 4
          ? { ...c, members: [...c.members, { role, specId }] }
          : c
      )
    );
  };
  const removeComboMember = (key: number, i: number) =>
    setCombos((prev) => prev.map((c) => (c.key === key ? { ...c, members: c.members.filter((_, j) => j !== i) } : c)));

  // Per-slot preferences and desired comps are mutually exclusive ways of
  // expressing what the group wants — picking one clears the other.
  const [prefMode, setPrefMode] = useState<"slots" | "combo">(
    () => (editGroup?.combos.length ? "combo" : "slots")
  );
  const switchPrefMode = (mode: "slots" | "combo") => {
    if (mode === prefMode) return;
    if (mode === "slots") setCombos([]);
    else setSlots((prev) => prev.map((s) => ({ ...s, prefs: [] })));
    setPrefMode(mode);
  };

  // HAVE = you (actual). WANT = every spec you've listed as acceptable, across
  // all ranked slot prefs and desired-comp members (whichever mode is active).
  const desiredSpecIds = useMemo(
    () => [
      ...slots.flatMap((s) => s.prefs),
      ...combos.flatMap((c) => c.members.map((m) => m.specId)),
    ],
    [slots, combos]
  );
  const buffCoverage = useMemo(
    () => computeBuffCoverage([ownerSpecId], desiredSpecIds),
    [ownerSpecId, desiredSpecIds]
  );
  const utilityCoverage = useMemo(
    () => computeUtilityCoverage([ownerSpecId], desiredSpecIds),
    [ownerSpecId, desiredSpecIds]
  );
  const defensiveCoverage = useMemo(
    () => computeDefensiveCoverage([ownerSpecId], desiredSpecIds),
    [ownerSpecId, desiredSpecIds]
  );
  const externalDefensiveCoverage = useMemo(
    () => computeExternalDefensiveCoverage([ownerSpecId], desiredSpecIds),
    [ownerSpecId, desiredSpecIds]
  );
  const dispelCoverage = useMemo(
    () => computeDispelCoverage([ownerSpecId], desiredSpecIds),
    [ownerSpecId, desiredSpecIds]
  );
  const enemyDispelCoverage = useMemo(
    () => computeEnemyDispelCoverage([ownerSpecId], desiredSpecIds),
    [ownerSpecId, desiredSpecIds]
  );

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!ownerSpecId) { setErr("Pick a spec to play."); return; }
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
          title,
          description: description.trim() || null,
          dungeonId, keyLevel, ownerRole,
          ownerCharacterId: owner.id, ownerSpecId,
          startsAt: startMode === "pick" && startAt ? new Date(startAt).toISOString() : null,
          slots: slots.map((s) => ({ role: s.role, prefs: s.prefs })),
          combos: combos.map((c) => c.members.map((m) => ({ role: m.role, specId: m.specId }))),
          requirementType: requirementType === "none" ? null : requirementType,
          reqRating: requirementType === "rating" ? reqRating : null,
          reqLevel: requirementType === "resilient" || requirementType === "custom" ? reqLevel : null,
          reqExtraCount: requirementType === "custom" ? reqExtraCount : null,
          reqExtraLevel: requirementType === "custom" ? reqExtraLevel : null,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const action = editGroup ? "Update" : "List";
        setErr(res.status === 401 ? "Session expired - log in again." : `${action} failed (${res.status}). ${body.slice(0, 140)}`);
        setSubmitting(false);
        return;
      }
      // Force a full navigation so a stale client bundle can't leave us hanging.
      window.location.assign("/runs");
    } catch (e) {
      setErr(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
      setSubmitting(false);
    }
  };

  // label DPS slots #1, #2, #3 for clarity
  const dpsIndex: number[] = [];
  let d = 0;
  slots.forEach((s) => dpsIndex.push(s.role === "DPS" ? ++d : 0));
  const dpsTotal = slots.filter((s) => s.role === "DPS").length;

  return (
    <div className="space-y-6">
      {/* title + description + dungeon + key + start time */}
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

        <Field label="Dungeon">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DUNGEONS.map((dg) => (
              <button
                key={dg.id} onClick={() => setDungeonId(dg.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-2 text-left",
                  dungeonId === dg.id ? "bg-accent/15 border-accent" : "border-panelborder hover:bg-panel2"
                )}
              >
                <WowIcon slug={dg.icon} size={32} rounded="sm" title={dg.name} />
                <div className="min-w-0">
                  <div className={cn("text-xs font-semibold", dungeonId === dg.id ? "text-accent" : "text-gray-300")}>{dg.abbr}</div>
                  <div className="text-[9px] font-normal opacity-70 truncate">{dg.name}</div>
                </div>
              </button>
            ))}
          </div>
        </Field>

        <Field label={`Key level: +${keyLevel}`}>
          <input
            type="range" min={MIN_KEY} max={MAX_KEY} value={keyLevel}
            onChange={(e) => setKeyLevel(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </Field>

        <Field label="Applicant requirement (optional)">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(["none", "rating", "resilient", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRequirementType(mode)}
                  className={cn(
                    "chip border",
                    requirementType === mode ? "border-accent text-accent" : "border-panelborder text-gray-400"
                  )}
                >
                  {mode === "none" ? "None" : mode === "rating" ? "Min rating" : mode === "resilient" ? "Resilient" : "Custom"}
                </button>
              ))}
            </div>

            {requirementType === "rating" && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="number" min={0} max={6000} value={reqRating}
                  onChange={(e) => setReqRating(Number(e.target.value) || 0)}
                  className="w-20 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
                <span className="text-gray-500">minimum rating</span>
              </div>
            )}

            {(requirementType === "resilient" || requirementType === "custom") && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-gray-500">Resilient +</span>
                <input
                  type="number" min={MIN_KEY} max={MAX_KEY} value={reqLevel}
                  onChange={(e) => setReqLevel(Number(e.target.value) || MIN_KEY)}
                  className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
                <span className="text-gray-500">on every dungeon this season, timed</span>
              </div>
            )}

            {requirementType === "custom" && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-gray-500">plus at least</span>
                <input
                  type="number" min={1} max={7} value={reqExtraCount}
                  onChange={(e) => setReqExtraCount(Number(e.target.value) || 1)}
                  className="w-14 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
                <span className="text-gray-500">dungeon(s) timed at +</span>
                <input
                  type="number" min={MIN_KEY} max={MAX_KEY} value={reqExtraLevel}
                  onChange={(e) => setReqExtraLevel(Number(e.target.value) || MIN_KEY)}
                  className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
              </div>
            )}

            <p className="text-[11px] text-gray-600">
              Advisory only — shown as a badge next to each applicant, never blocks anyone from applying.
            </p>
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

      {/* who you're listing as: fixed to this key's original owner/spec when
          editing (see editOwnerMember above); set via the navbar picker only
          when listing a new key */}
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
          {editGroup ? "This key's original character - not editable here." : "Change character in the navbar picker ↑"}
        </p>
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
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Open slots</div>
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
        /* pre-made group combos: an alternative to filling slots one at a time */
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Desired comps</label>
            <span className="text-[11px] text-gray-600">Pick 2-4 specs as a bundle - a duo, a trio, or the whole rest of the team</span>
          </div>
          {combos.map((combo) => (
            <ComboEditor
              key={combo.key}
              members={combo.members}
              ownerSpecId={ownerSpecId}
              onAdd={(specId) => addComboMember(combo.key, specId)}
              onRemove={(i) => removeComboMember(combo.key, i)}
              onDelete={() => removeCombo(combo.key)}
            />
          ))}
          <button onClick={addCombo} className="btn-ghost text-xs px-3 py-1.5">+ Add a combo</button>
        </div>
      )}

      {/* buffs & debuffs: have (you) | want (desired) | missing */}
      <CoveragePanel title="Buffs & Debuffs" coverage={buffCoverage} />

      {/* utility: lust/res + external/party utility, same have/want/missing shape */}
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

      {/* friendly dispels: Magic/Curse/Poison/Disease/Bleed removal */}
      <CoveragePanel title="Friendly Dispels" coverage={dispelCoverage} />

      {/* enemy magic dispels + enrage removal */}
      <CoveragePanel title="Enemy Magic Dispels" coverage={enemyDispelCoverage} />

      {/* party defensives: same have/want/missing breakdown, spec-locked cooldowns */}
      <CoveragePanel title="Party Defensives" coverage={defensiveCoverage} />

      {/* external defensives: single-target cooldowns, same have/want/missing shape */}
      <CoveragePanel title="External Defensives" coverage={externalDefensiveCoverage} />

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <button onClick={submit} disabled={submitting} className="btn-gold">
        {editGroup ? (submitting ? "Saving…" : "Save changes") : (submitting ? "Listing…" : "List key")}
      </button>
    </div>
  );
}
