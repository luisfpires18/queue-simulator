"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/dto";
import { type Role } from "@/game/classes";
import { DUNGEONS, DUNGEON_BY_ID } from "@/game/season";
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

const MIN_KEY = 2;
const MAX_KEY = 25;

// remaining slots to complete 1 tank / 1 healer / 3 dps after the owner's role
function openSlotsFor(ownerRole: Role): FormSlot[] {
  const need: Record<Role, number> = { TANK: 1, HEALER: 1, DPS: 3 };
  need[ownerRole] -= 1;
  const slots: FormSlot[] = [];
  (["TANK", "HEALER", "DPS"] as Role[]).forEach((r) => {
    for (let i = 0; i < need[r]; i++) slots.push({ role: r, prefs: [] });
  });
  return slots;
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
  const [route, setRoute] = useState(editGroup?.route ?? "");

  const [startMode, setStartMode] = useState<"now" | "pick">(editGroup?.startsAt ? "pick" : "now");
  const [startAt, setStartAt] = useState(editGroup?.startsAt ? toLocalInputValue(editGroup.startsAt) : "");

  // Who you're listing as — see resolveListingOwner: fixed to this key's
  // original owner/spec (slot 0) when editing, the navbar picker otherwise.
  const { owner, ownerSpecId, ownerRole } = resolveListingOwner(current, editGroup);

  // open slots rebuild only when the owner's role actually changes (e.g. the
  // navbar character picker switches spec) — not on mount, so loading an
  // existing key's slots (edit mode) doesn't get clobbered. Comparing against
  // the last-seen role (rather than a "have we run yet" flag) keeps this safe
  // under React Strict Mode's dev double-invoke of effects.
  const [slots, setSlots] = useState<FormSlot[]>(
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

  // Pre-made-group combos (2-4 members, an alternative to per-slot picks) -
  // a desired comp is a bundle of specs (not your own characters), e.g. a
  // known-good trio you'd want to see show up together in one group.
  const { combos, addCombo, removeCombo, addComboMember, removeComboMember, prefMode, switchPrefMode } =
    useComboBuilder(editGroup, 4, setSlots);

  const {
    buffCoverage, utilityCoverage, defensiveCoverage, externalDefensiveCoverage, dispelCoverage, enemyDispelCoverage, skipCoverage,
  } = useListingCoverage(ownerSpecId, slots, combos);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!ownerSpecId) { setErr("Pick a spec to play."); return; }
    if (ownerRole === "TANK" && !route.trim()) { setErr("Route is required when tanking this key."); return; }
    if (prefMode === "combo") {
      const badCombo = combos.find((c) => c.members.length < 2);
      if (badCombo) { setErr("A combo needs at least 2 members (or remove it)."); return; }
    }
    setSubmitting(true);
    const error = await submitListingRequest(editGroup, {
      title,
      description: description.trim() || null,
      route: route.trim() || null,
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
    });
    if (error) {
      setErr(error);
      setSubmitting(false);
      return;
    }
    // Force a full navigation so a stale client bundle can't leave us hanging.
    window.location.assign("/runs");
  };

  const labels = slotLabels(slots);

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

        <Field label={`Route (Mythic Dungeon Tools) - ${ownerRole === "TANK" ? "required for Tank" : "optional"}`}>
          <textarea
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            maxLength={4000}
            rows={3}
            placeholder="Paste your MDT route link or import string..."
            className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-xs font-mono resize-none"
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
                label={labels[i]}
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
      <UtilityCoveragePanel coverage={utilityCoverage} />

      {/* friendly dispels: Magic/Curse/Poison/Disease/Bleed removal */}
      <CoveragePanel title="Friendly Dispels" coverage={dispelCoverage} />

      {/* enemy magic dispels + enrage removal */}
      <CoveragePanel title="Enemy Magic Dispels" coverage={enemyDispelCoverage} />

      {/* party defensives: same have/want/missing breakdown, spec-locked cooldowns */}
      <CoveragePanel title="Party Defensives" coverage={defensiveCoverage} />

      {/* external defensives: single-target cooldowns, same have/want/missing shape */}
      <CoveragePanel title="External Defensives" coverage={externalDefensiveCoverage} />

      {/* trash skips: Shroud / Gateway / Rescue */}
      <CoveragePanel title="Skips" coverage={skipCoverage} />

      <div className="flex items-center gap-3">
        <Link href="/runs" className="btn-ghost">
          ← Go back
        </Link>
        <button onClick={submit} disabled={submitting} className="btn-gold">
          {editGroup ? (submitting ? "Saving…" : "Save changes") : (submitting ? "Listing…" : "List key")}
        </button>
      </div>

      <ErrorModal
        open={err != null}
        title={editGroup ? "Couldn't save changes" : "Couldn't list your key"}
        message={err ?? ""}
        onClose={() => setErr(null)}
      />
    </div>
  );
}
