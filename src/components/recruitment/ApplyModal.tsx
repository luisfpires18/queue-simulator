"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, FilterChip, FilterGroup, inputClass } from "@/components/ui/Filters";
import { SpecIcon } from "@/components/SpecIcon";
import { apiPost } from "@/lib/api-client";
import { ALL_SPECS, specById, type Role } from "@/game/classes";
import type { WeeklySlot } from "@/game/availability";
import type { CharacterDTO } from "@/data/dto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import { AvailabilityPicker } from "./AvailabilityPicker";

const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export interface ApplyTargetPosition {
  id: string;
  role: string;
  label: string;
}

/** Apply to a recruitment listing.
 *
 * Separate from the live board's ApplyModal, which is bound to GroupDTO and
 * MDT routes and answers a different question ("can I come to this key"). This
 * one is about a standing commitment, so it collects availability and
 * alternate specs that the other one has no use for.
 */
export function ApplyModal({
  open,
  onClose,
  recruitmentType,
  targetId,
  targetName,
  positions,
  characters,
  existing,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  recruitmentType: "mplus" | "guild";
  targetId: string;
  targetName: string;
  positions: ApplyTargetPosition[];
  characters: CharacterDTO[];
  /** A live application, when the user has already applied - the form becomes
   * an edit and the button says so. */
  existing?: RecruitmentApplicationDTO | null;
  onApplied: (application: RecruitmentApplicationDTO) => void;
}) {
  const [characterId, setCharacterId] = useState(existing?.characterId ?? characters[0]?.id ?? "");
  // Defaults to the character's OWN spec, not the first of its class. Falling
  // back to charSpecs[0] put a Protection Paladin in as Holy, and since `role`
  // was independently defaulted to DPS, an untouched form submitted a healer
  // spec under a DPS role.
  const [specId, setSpecId] = useState(
    existing?.specId ?? characters[0]?.specId ?? ""
  );
  const [alternateSpecIds, setAlternateSpecIds] = useState<string[]>(existing?.alternateSpecIds ?? []);
  // Null until the user picks, so the default can follow the resolved role
  // (below) rather than freezing positions[0] at mount - defaulting a
  // Protection tank onto the healer opening invites mis-filed applications.
  const [positionId, setPositionId] = useState<string | null>(existing?.positionId ?? null);
  const [availability, setAvailability] = useState<WeeklySlot[]>(existing?.availability ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const character = characters.find((c) => c.id === characterId);
  const charSpecs = character ? ALL_SPECS.filter((s) => s.classId === character.classId) : [];
  // Prefer the explicit pick, then the character's live spec, then the first
  // of its class as a last resort.
  const effectiveSpecId = specId || character?.specId || charSpecs[0]?.id || "";

  // Derived, never separately held: role and spec cannot disagree if only one
  // of them is state. specById is the single source of truth for which role a
  // spec belongs to.
  const role: Role = (specById(effectiveSpecId)?.role ?? "DPS") as Role;

  // The opening that matches what they actually play, falling back to the
  // first one when the team has nothing open in their role (applying anyway is
  // legitimate - "general interest" exists for exactly that).
  const effectivePositionId =
    positionId ?? positions.find((p) => p.role === role)?.id ?? positions[0]?.id ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ application: RecruitmentApplicationDTO }>(
        "/api/recruitment/applications",
        {
          recruitmentType,
          targetId,
          positionId: effectivePositionId,
          characterId,
          specId: effectiveSpecId,
          alternateSpecIds,
          role,
          availability,
          note: note.trim() || null,
        }
      );
      onApplied(res.application);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your application.");
    } finally {
      setBusy(false);
    }
  }

  if (!characters.length) {
    return (
      <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-md p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">No characters synced</h2>
        <p className="mt-2 text-sm text-gray-500">
          Sync your Battle.net roster from your profile before applying.
        </p>
        <button type="button" onClick={onClose} className="btn-ghost mt-4">
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-white">
        {existing ? "Update your application" : "Apply"}
      </h2>
      <p className="mt-1 text-sm text-gray-500">{targetName}</p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Character">
            <select
              value={characterId}
              onChange={(e) => {
                setCharacterId(e.target.value);
                // Cleared so the new character's own spec is picked up by the
                // fallback chain rather than carrying the old class's spec.
                setSpecId("");
                setAlternateSpecIds([]);
              }}
              className={inputClass}
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.realm}
                  {c.isMain ? " (main)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Spec">
            <select
              value={effectiveSpecId}
              onChange={(e) => {
                // Role follows from the spec automatically - see the derived
                // `role` above.
                setSpecId(e.target.value);
              }}
              className={inputClass}
            >
              {charSpecs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({ROLE_LABEL[s.role]})
                </option>
              ))}
            </select>
          </Field>
        </div>

        {positions.length > 0 && (
          <Field label="Position" hint="Which opening you are applying for.">
            <select
              value={effectivePositionId ?? ""}
              onChange={(e) => setPositionId(e.target.value || null)}
              className={inputClass}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              {/* Applying without a specific opening is legitimate - a good
                  player is worth hearing from even with nothing open today. */}
              <option value="">General interest</option>
            </select>
          </Field>
        )}

        {charSpecs.length > 1 && (
          <FilterGroup label="Other specs you can play">
            {charSpecs
              .filter((s) => s.id !== effectiveSpecId)
              .map((s) => (
                <FilterChip
                  key={s.id}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <SpecIcon specId={s.id} size={14} showRole={false} />
                      {s.name}
                    </span>
                  }
                  selected={alternateSpecIds.includes(s.id)}
                  onClick={() =>
                    setAlternateSpecIds((a) =>
                      a.includes(s.id) ? a.filter((x) => x !== s.id) : [...a, s.id]
                    )
                  }
                />
              ))}
          </FilterGroup>
        )}

        <AvailabilityPicker
          value={availability}
          onChange={setAvailability}
          label="Your availability for this team"
        />

        <Field label="Note" hint="Anything the team should know.">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={2000}
            className={inputClass}
            placeholder="Why you are a good fit, and how to reach you."
          />
        </Field>

        {error && (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button type="submit" disabled={busy} className="btn-gold">
            {busy ? "Sending..." : existing ? "Update application" : "Send application"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
