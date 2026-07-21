"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { ALL_SPECS, specById, type Role } from "@/game/classes";
import type { WeeklySlot } from "@/game/availability";
import {
  ATMOSPHERE_OPTIONS,
  GOAL_OPTIONS,
  LANGUAGE_OPTIONS,
  MAX_KEY_LEVEL,
  MIN_KEY_LEVEL,
  POST_TYPE_OPTIONS,
  REGION_OPTIONS,
  TEAM_MATURITY_OPTIONS,
  TIMEZONE_OPTIONS,
  VOICE_PLATFORM_OPTIONS,
  isTeamPost,
} from "@/game/recruitmentTypes";
import { Field, FilterChip, FilterGroup, MultiSelect, Select, inputClass } from "@/components/ui/Filters";
import { SpecIcon } from "@/components/SpecIcon";
import { CountrySelect } from "@/components/CountrySelect";
import type { CharacterDTO } from "@/data/dto";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";
import { AvailabilityPicker } from "./AvailabilityPicker";

const ROLES: Role[] = ["TANK", "HEALER", "DPS"];
const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

interface PositionDraft {
  key: number;
  role: Role;
  preferredSpecIds: string[];
  acceptedSpecIds: string[];
  isPermanent: boolean;
  isFlexible: boolean;
  priority: number;
}

/** Guesses the browser's zone so the schedule is right by default. Getting
 * this wrong silently is the single easiest way to break schedule matching,
 * so it is prefilled rather than left blank. */
function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function RecruitmentPostForm({
  characters,
  editPost,
}: {
  characters: CharacterDTO[];
  editPost?: MPlusRecruitmentPostDTO | null;
}) {
  const router = useRouter();
  const editing = !!editPost;

  const [postType, setPostType] = useState(editPost?.postType ?? "player_lft");
  const [title, setTitle] = useState(editPost?.title ?? "");
  const [teamName, setTeamName] = useState(editPost?.teamName ?? "");
  const [description, setDescription] = useState(editPost?.description ?? "");
  const [region, setRegion] = useState(editPost?.region ?? characters[0]?.region ?? "eu");
  const [country, setCountry] = useState<string | null>(editPost?.country ?? null);
  const [languages, setLanguages] = useState<string[]>(editPost?.languages ?? ["en"]);
  const [timeZone, setTimeZone] = useState(editPost?.timeZone ?? guessTimeZone());
  const [availability, setAvailability] = useState<WeeklySlot[]>(editPost?.availability ?? []);
  const [goal, setGoal] = useState(editPost?.goal ?? "timing");

  const [currentKeyMin, setCurrentKeyMin] = useState(editPost?.currentKeyMin?.toString() ?? "");
  const [currentKeyMax, setCurrentKeyMax] = useState(editPost?.currentKeyMax?.toString() ?? "");
  const [targetKeyMin, setTargetKeyMin] = useState(editPost?.targetKeyMin?.toString() ?? "");
  const [targetKeyMax, setTargetKeyMax] = useState(editPost?.targetKeyMax?.toString() ?? "");

  const [voiceRequired, setVoiceRequired] = useState(editPost?.voiceRequired ?? false);
  const [voicePlatform, setVoicePlatform] = useState(editPost?.voicePlatform ?? "discord");
  const [teamMaturity, setTeamMaturity] = useState(editPost?.teamMaturity ?? "new");
  const [atmosphere, setAtmosphere] = useState(editPost?.atmosphere ?? "focused");
  const [showLogs, setShowLogs] = useState(editPost?.showLogs ?? false);
  const [showProfile, setShowProfile] = useState(editPost?.showProfile ?? true);

  // The advertised character(s). Only the caller's own characters can be
  // listed - the API enforces this too, since a post claiming someone else's
  // main would otherwise be trivial to publish.
  const firstEntry = editPost?.characters[0];
  const [characterId, setCharacterId] = useState(firstEntry?.characterId ?? characters[0]?.id ?? "");
  // Seeded from the character's own spec, not the first of its class - see the
  // note in ApplyModal. Role is derived from it below rather than held
  // separately, so the two can never disagree.
  const [primarySpecId, setPrimarySpecId] = useState(
    firstEntry?.primarySpecId ?? characters[0]?.specId ?? ""
  );
  const [alternateSpecIds, setAlternateSpecIds] = useState<string[]>(firstEntry?.alternateSpecIds ?? []);
  const [willingRoles, setWillingRoles] = useState<string[]>(firstEntry?.willingRoles ?? []);

  const [positions, setPositions] = useState<PositionDraft[]>(
    editPost?.positions.map((p, i) => ({
      key: i,
      role: p.role as Role,
      preferredSpecIds: p.preferredSpecIds,
      acceptedSpecIds: p.acceptedSpecIds,
      isPermanent: p.isPermanent,
      isFlexible: p.isFlexible,
      priority: p.priority,
    })) ?? []
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeam = isTeamPost(postType);
  const selectedChar = characters.find((c) => c.id === characterId);

  // Specs offered for the picked character, so the list is that class's three
  // specs rather than all 40.
  const charSpecs = selectedChar ? ALL_SPECS.filter((s) => s.classId === selectedChar.classId) : [];
  const effectiveSpecId = primarySpecId || selectedChar?.specId || charSpecs[0]?.id || "";
  const preferredRole: Role = (specById(effectiveSpecId)?.role ?? "DPS") as Role;

  function addPosition() {
    setPositions((p) => [
      ...p,
      {
        key: Date.now(),
        role: "DPS",
        preferredSpecIds: [],
        acceptedSpecIds: [],
        isPermanent: true,
        isFlexible: false,
        priority: 0,
      },
    ]);
  }

  function updatePosition(key: number, patch: Partial<PositionDraft>) {
    setPositions((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const num = (v: string) => (v.trim() === "" ? null : Number(v));

    const payload = {
      postType,
      title: title.trim() || (isTeam ? teamName.trim() : selectedChar?.name) || "Recruitment post",
      description: description.trim() || null,
      teamName: isTeam ? teamName.trim() : null,
      region,
      country,
      languages,
      timeZone: timeZone || null,
      availability,
      goal,
      currentKeyMin: num(currentKeyMin),
      currentKeyMax: num(currentKeyMax),
      targetKeyMin: num(targetKeyMin),
      targetKeyMax: num(targetKeyMax),
      voiceRequired,
      voicePlatform: voiceRequired ? voicePlatform : null,
      teamMaturity: isTeam ? teamMaturity : null,
      atmosphere,
      showLogs,
      showProfile,
      characters: characterId
        ? [
            {
              characterId,
              primarySpecId: effectiveSpecId,
              alternateSpecIds,
              preferredRole,
              willingRoles,
              isMain: selectedChar?.isMain ?? false,
              isCurrentMember: isTeam,
              teamRole: isTeam ? "leader" : null,
            },
          ]
        : [],
      positions: isTeam
        ? positions.map((p) => ({
            role: p.role,
            preferredSpecIds: p.preferredSpecIds,
            acceptedSpecIds: p.acceptedSpecIds,
            priority: p.priority,
            isPermanent: p.isPermanent,
            isFlexible: p.isFlexible,
            isFilled: false,
          }))
        : [],
    };

    try {
      const res = await apiPost<{ id: string; post: MPlusRecruitmentPostDTO }>(
        editing ? `/api/recruitment/mplus/${editPost!.id}` : "/api/recruitment/mplus",
        payload,
        editing ? "PATCH" : "POST"
      );
      router.push(`/recruitment/${editing ? editPost!.id : res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the post.");
      setBusy(false);
    }
  }

  if (!characters.length) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-gray-300">No characters synced yet.</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500">
          Sync your Battle.net roster from your profile first - a recruitment post is built around a
          character.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">What are you posting?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {POST_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setPostType(o.value)}
              aria-pressed={postType === o.value}
              className={`rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                postType === o.value
                  ? "border-accent bg-accent/10"
                  : "border-panelborder hover:border-gray-600"
              }`}
            >
              <span className="block text-sm font-semibold text-white">{o.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{o.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">
          {isTeam ? "Your team" : "Your character"}
        </h2>

        {isTeam && (
          <Field label="Team name">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={60}
              required
              placeholder="e.g. Tuesday Push Crew"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Headline" hint="Shown at the top of your post.">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={isTeam ? "Looking for a permanent healer" : "Resto Druid looking for a weekly team"}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isTeam ? "Your character" : "Character"}>
            <select
              value={characterId}
              onChange={(e) => {
                setCharacterId(e.target.value);
                setPrimarySpecId("");
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
          <FilterGroup label="Alternate specs you can play">
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

        <FilterGroup label="Roles you are willing to play">
          {ROLES.map((r) => (
            <FilterChip
              key={r}
              label={ROLE_LABEL[r]}
              selected={willingRoles.includes(r)}
              onClick={() =>
                setWillingRoles((w) => (w.includes(r) ? w.filter((x) => x !== r) : [...w, r]))
              }
            />
          ))}
        </FilterGroup>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">Keys and goals</h2>

        <Select
          label="Goal"
          value={goal}
          onChange={setGoal}
          options={GOAL_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <KeyRangeField
            label="Keys you run now"
            min={currentKeyMin}
            max={currentKeyMax}
            onMin={setCurrentKeyMin}
            onMax={setCurrentKeyMax}
          />
          <KeyRangeField
            label="Keys you are aiming for"
            min={targetKeyMin}
            max={targetKeyMax}
            onMin={setTargetKeyMin}
            onMax={setTargetKeyMax}
          />
        </div>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">When and where</h2>

        <AvailabilityPicker value={availability} onChange={setAvailability} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Region" value={region} onChange={setRegion} options={REGION_OPTIONS} />
          <Select
            label="Time zone"
            value={timeZone}
            onChange={setTimeZone}
            options={TIMEZONE_OPTIONS}
            placeholder="Not set"
          />
          <Field label="Country" hint="Optional. Shows a flag on your post, like your profile does.">
            <CountrySelect value={country} onChange={setCountry} />
          </Field>
        </div>

        <MultiSelect label="Languages" values={languages} onChange={setLanguages} options={LANGUAGE_OPTIONS} />

        <div className="flex flex-wrap items-end gap-4">
          <FilterGroup label="Voice">
            <FilterChip
              label="Voice required"
              selected={voiceRequired}
              onClick={() => setVoiceRequired((v) => !v)}
            />
          </FilterGroup>
          {voiceRequired && (
            <Select
              label="Platform"
              value={voicePlatform}
              onChange={setVoicePlatform}
              options={VOICE_PLATFORM_OPTIONS}
              className="w-48"
            />
          )}
        </div>
      </section>

      {isTeam && (
        <section className="panel space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Open positions</h2>
            <button type="button" onClick={addPosition} className="btn-ghost">
              Add position
            </button>
          </div>

          {!positions.length && (
            <p className="text-sm text-gray-500">
              Add at least one position so players know what you are looking for.
            </p>
          )}

          {positions.map((p) => (
            <PositionEditor
              key={p.key}
              draft={p}
              onChange={(patch) => updatePosition(p.key, patch)}
              onRemove={() => setPositions((all) => all.filter((x) => x.key !== p.key))}
            />
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Team status"
              value={teamMaturity}
              onChange={setTeamMaturity}
              options={TEAM_MATURITY_OPTIONS}
            />
            <Select
              label="Atmosphere"
              value={atmosphere}
              onChange={setAtmosphere}
              options={ATMOSPHERE_OPTIONS.map((a) => ({ value: a.value, label: a.label }))}
            />
          </div>
        </section>
      )}

      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">About</h2>
        <Field label="Introduction" hint="What you are like to play with, and how to reach you.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={5}
            className={inputClass}
            placeholder="Tell people what you are looking for."
          />
        </Field>

        <FilterGroup label="Visibility">
          <FilterChip
            label="Show my public profile"
            selected={showProfile}
            onClick={() => setShowProfile((v) => !v)}
          />
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
          {busy ? "Saving..." : editing ? "Save changes" : "Publish post"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function KeyRangeField({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={MIN_KEY_LEVEL}
          max={MAX_KEY_LEVEL}
          value={min}
          onChange={(e) => onMin(e.target.value)}
          placeholder="Min"
          aria-label={`${label}, minimum`}
          className={inputClass}
        />
        <span className="text-gray-600">-</span>
        <input
          type="number"
          min={MIN_KEY_LEVEL}
          max={MAX_KEY_LEVEL}
          value={max}
          onChange={(e) => onMax(e.target.value)}
          placeholder="Max"
          aria-label={`${label}, maximum`}
          className={inputClass}
        />
      </div>
    </div>
  );
}

function PositionEditor({
  draft,
  onChange,
  onRemove,
}: {
  draft: PositionDraft;
  onChange: (patch: Partial<PositionDraft>) => void;
  onRemove: () => void;
}) {
  const roleSpecs = ALL_SPECS.filter((s) => s.role === draft.role);

  return (
    <div className="rounded-lg border border-panelborder p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterGroup label="Role">
          {ROLES.map((r) => (
            <FilterChip
              key={r}
              label={ROLE_LABEL[r]}
              selected={draft.role === r}
              onClick={() => onChange({ role: r, preferredSpecIds: [], acceptedSpecIds: [] })}
            />
          ))}
        </FilterGroup>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          Remove
        </button>
      </div>

      <div className="mt-3">
        <FilterGroup label="Preferred specs (leave empty for any)">
          {roleSpecs.map((s) => (
            <FilterChip
              key={s.id}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <SpecIcon specId={s.id} size={14} showRole={false} />
                  {s.name}
                </span>
              }
              selected={draft.preferredSpecIds.includes(s.id)}
              onClick={() =>
                onChange({
                  preferredSpecIds: draft.preferredSpecIds.includes(s.id)
                    ? draft.preferredSpecIds.filter((x) => x !== s.id)
                    : [...draft.preferredSpecIds, s.id],
                })
              }
            />
          ))}
        </FilterGroup>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <FilterChip
          label={draft.isPermanent ? "Permanent spot" : "Substitute spot"}
          selected={draft.isPermanent}
          onClick={() => onChange({ isPermanent: !draft.isPermanent })}
        />
        <FilterChip
          label="Role is flexible"
          selected={draft.isFlexible}
          onClick={() => onChange({ isFlexible: !draft.isFlexible })}
        />
        <FilterChip
          label="High priority"
          selected={draft.priority > 0}
          onClick={() => onChange({ priority: draft.priority > 0 ? 0 : 1 })}
        />
      </div>
    </div>
  );
}
