"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { ALL_SPECS, specById, type Role } from "@/game/classes";
import type { WeeklySlot } from "@/game/availability";
import {
  ATMOSPHERE_OPTIONS,
  COMPETITIVE_LEVEL_OPTIONS,
  LANGUAGE_OPTIONS,
  RAID_DIFFICULTY_OPTIONS,
  REGION_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/game/recruitmentTypes";
import { Field, FilterChip, FilterGroup, MultiSelect, Select, inputClass } from "@/components/ui/Filters";
import { SpecIcon } from "@/components/SpecIcon";
import { CountrySelect } from "@/components/CountrySelect";
import type { CharacterDTO } from "@/data/dto";
import type { RaiderProfileDTO } from "@/data/recruitmentDto";
import { AvailabilityPicker } from "@/components/recruitment/AvailabilityPicker";

const ROLES: Role[] = ["TANK", "HEALER", "DPS"];
const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function RaiderProfileForm({
  characters,
  editProfile,
}: {
  characters: CharacterDTO[];
  editProfile?: RaiderProfileDTO | null;
}) {
  const router = useRouter();
  const editing = !!editProfile;

  const [characterId, setCharacterId] = useState(editProfile?.characterId ?? characters[0]?.id ?? "");
  // Seeded from the character's own spec, not the first of its class, and
  // preferredRole is derived from it below - see the note in ApplyModal.
  const [primarySpecId, setPrimarySpecId] = useState(
    editProfile?.primarySpecId ?? characters[0]?.specId ?? ""
  );
  const [alternateSpecIds, setAlternateSpecIds] = useState<string[]>(editProfile?.alternateSpecIds ?? []);
  const [offRoles, setOffRoles] = useState<string[]>(editProfile?.offRoles ?? []);

  const [title, setTitle] = useState(editProfile?.title ?? "");
  const [introduction, setIntroduction] = useState(editProfile?.introduction ?? "");
  const [region, setRegion] = useState(editProfile?.region ?? characters[0]?.region ?? "eu");
  const [country, setCountry] = useState<string | null>(editProfile?.country ?? null);
  const [languages, setLanguages] = useState<string[]>(editProfile?.languages ?? ["en"]);
  const [timeZone, setTimeZone] = useState(editProfile?.timeZone ?? guessTimeZone());
  const [availability, setAvailability] = useState<WeeklySlot[]>(editProfile?.availability ?? []);

  const [preferredDifficulty, setPreferredDifficulty] = useState(editProfile?.preferredDifficulty ?? "heroic");
  const [currentProgression, setCurrentProgression] = useState(editProfile?.currentProgression ?? "");
  const [previousProgression, setPreviousProgression] = useState(editProfile?.previousProgression ?? "");
  const [attendance, setAttendance] = useState(editProfile?.attendanceExpectation?.toString() ?? "");

  const [voiceAvailable, setVoiceAvailable] = useState(editProfile?.voiceAvailable ?? true);
  const [transferWilling, setTransferWilling] = useState(editProfile?.transferWilling ?? false);
  const [factionFlexible, setFactionFlexible] = useState(editProfile?.factionFlexible ?? false);
  const [trialAvailable, setTrialAvailable] = useState(editProfile?.trialAvailable ?? true);
  const [atmosphere, setAtmosphere] = useState(editProfile?.atmosphere ?? "focused");
  const [competitiveLevel, setCompetitiveLevel] = useState(editProfile?.competitiveLevel ?? "semi_hardcore");
  const [showLogs, setShowLogs] = useState(editProfile?.showLogs ?? false);
  const [showProfile, setShowProfile] = useState(editProfile?.showProfile ?? true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChar = characters.find((c) => c.id === characterId);
  const charSpecs = selectedChar ? ALL_SPECS.filter((s) => s.classId === selectedChar.classId) : [];
  const effectiveSpecId = primarySpecId || selectedChar?.specId || charSpecs[0]?.id || "";
  const preferredRole: Role = (specById(effectiveSpecId)?.role ?? "DPS") as Role;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      characterId,
      primarySpecId: effectiveSpecId,
      alternateSpecIds,
      preferredRole,
      offRoles,
      title: title.trim() || null,
      introduction: introduction.trim() || null,
      region,
      country,
      languages,
      timeZone: timeZone || null,
      availability,
      preferredDifficulty,
      currentProgression: currentProgression.trim() || null,
      previousProgression: previousProgression.trim() || null,
      // Left empty on create so the server seeds it from the character's
      // already-synced raid kills; on edit the existing detail is preserved.
      bossExperience: editProfile?.bossExperience ?? [],
      attendanceExpectation: attendance.trim() === "" ? null : Number(attendance),
      voiceAvailable,
      transferWilling,
      factionFlexible,
      atmosphere,
      competitiveLevel,
      trialAvailable,
      showLogs,
      showProfile,
    };

    try {
      const res = await apiPost<{ id: string }>(
        editing ? `/api/guilds/raiders/${editProfile!.id}` : "/api/guilds/raiders",
        payload,
        editing ? "PATCH" : "POST"
      );
      router.push(`/guilds?tab=raiders`);
      void res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the profile.");
      setBusy(false);
    }
  }

  if (!characters.length) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-gray-300">No characters synced yet.</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500">
          Sync your Battle.net roster from your profile first - a raider profile is built around a character.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">Character</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Character">
            <select
              value={characterId}
              onChange={(e) => {
                setCharacterId(e.target.value);
                setPrimarySpecId("");
                setAlternateSpecIds([]);
              }}
              disabled={editing}
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

          <Field label="Main spec">
            <select
              value={effectiveSpecId}
              onChange={(e) => {
                // Role follows from the spec - see the derived preferredRole.
                setPrimarySpecId(e.target.value);
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

        {charSpecs.length > 1 && (
          <FilterGroup label="Alternate specs">
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
                    setAlternateSpecIds((a) => (a.includes(s.id) ? a.filter((x) => x !== s.id) : [...a, s.id]))
                  }
                />
              ))}
          </FilterGroup>
        )}

        <FilterGroup label="Roles you can cover when asked">
          {ROLES.map((r) => (
            <FilterChip
              key={r}
              label={ROLE_LABEL[r]}
              selected={offRoles.includes(r)}
              onClick={() => setOffRoles((o) => (o.includes(r) ? o.filter((x) => x !== r) : [...o, r]))}
            />
          ))}
        </FilterGroup>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">Raiding</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Preferred difficulty"
            value={preferredDifficulty}
            onChange={setPreferredDifficulty}
            options={RAID_DIFFICULTY_OPTIONS}
          />
          <Field label="Attendance you can commit to" hint="Percent.">
            <input
              type="number"
              min={0}
              max={100}
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Current progression" hint='Free text, e.g. "6/8 M".'>
            <input
              value={currentProgression}
              onChange={(e) => setCurrentProgression(e.target.value)}
              maxLength={100}
              className={inputClass}
            />
          </Field>
          <Field label="Previous tier">
            <input
              value={previousProgression}
              onChange={(e) => setPreviousProgression(e.target.value)}
              maxLength={100}
              className={inputClass}
            />
          </Field>
        </div>

        {!editing && (
          <p className="text-xs text-gray-500">
            Your boss experience is filled in automatically from the raid kills already synced to this
            character. You can refine it after publishing.
          </p>
        )}
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">When and where</h2>

        <AvailabilityPicker value={availability} onChange={setAvailability} label="Nights you can raid" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Region" value={region} onChange={setRegion} options={REGION_OPTIONS} />
          <Select
            label="Time zone"
            value={timeZone}
            onChange={setTimeZone}
            options={TIMEZONE_OPTIONS}
            placeholder="Not set"
          />
          <Field label="Country" hint="Optional. Shows a flag on your profile card.">
            <CountrySelect value={country} onChange={setCountry} />
          </Field>
        </div>

        <MultiSelect label="Languages" values={languages} onChange={setLanguages} options={LANGUAGE_OPTIONS} />

        <FilterGroup label="Flexibility">
          <FilterChip label="Voice available" selected={voiceAvailable} onClick={() => setVoiceAvailable((v) => !v)} />
          <FilterChip label="Willing to transfer" selected={transferWilling} onClick={() => setTransferWilling((v) => !v)} />
          <FilterChip label="Faction flexible" selected={factionFlexible} onClick={() => setFactionFlexible((v) => !v)} />
          <FilterChip label="Available to trial" selected={trialAvailable} onClick={() => setTrialAvailable((v) => !v)} />
        </FilterGroup>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">About you</h2>

        <Field label="Headline">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Experienced ranged DPS looking for a Mythic team"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Preferred atmosphere"
            value={atmosphere}
            onChange={setAtmosphere}
            options={ATMOSPHERE_OPTIONS.map((a) => ({ value: a.value, label: a.label }))}
          />
          <Select
            label="Competitive level"
            value={competitiveLevel}
            onChange={setCompetitiveLevel}
            options={COMPETITIVE_LEVEL_OPTIONS}
          />
        </div>

        <Field label="Introduction">
          <textarea
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
            rows={5}
            maxLength={2000}
            className={inputClass}
            placeholder="What you are looking for and how to reach you."
          />
        </Field>

        <FilterGroup label="Visibility">
          <FilterChip label="Show my public profile" selected={showProfile} onClick={() => setShowProfile((v) => !v)} />
          <FilterChip
            label="Show my Warcraft Logs"
            selected={showLogs}
            onClick={() => setShowLogs((v) => !v)}
            title="Off by default - logs are supporting evidence, not the front door to a listing."
          />
        </FilterGroup>
      </section>

      {error && (
        <p className="panel px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-gold">
          {busy ? "Saving..." : editing ? "Save changes" : "Publish profile"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
