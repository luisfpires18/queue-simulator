"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { ALL_SPECS, type Role } from "@/game/classes";
import type { WeeklySlot } from "@/game/availability";
import {
  LANGUAGE_OPTIONS,
  RAID_DIFFICULTY_OPTIONS,
  RAID_RECRUITMENT_TYPE_OPTIONS,
  REGION_OPTIONS,
  TIMEZONE_OPTIONS,
  VOICE_PLATFORM_OPTIONS,
} from "@/game/recruitmentTypes";
import { RAIDS } from "@/game/raidSeason";
import { Field, FilterChip, FilterGroup, MultiSelect, Select, inputClass } from "@/components/ui/Filters";
import { SpecIcon } from "@/components/SpecIcon";
import { CountrySelect } from "@/components/CountrySelect";
import type { GuildDTO } from "@/data/recruitmentDto";
import { AvailabilityPicker } from "@/components/recruitment/AvailabilityPicker";

const ROLES: Role[] = ["TANK", "HEALER", "DPS"];
const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

interface PositionDraft {
  key: number;
  role: Role;
  preferredSpecIds: string[];
  recruitmentType: string;
  priority: number;
}

function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/** Creates a guild AND its first raid team in one flow. Splitting them would
 * leave a guild with nothing to browse, which is the state nobody wants. Extra
 * teams are added later from the guild's own page. */
export function GuildForm({ editGuild }: { editGuild?: GuildDTO | null }) {
  const router = useRouter();
  const editing = !!editGuild;

  const [name, setName] = useState(editGuild?.name ?? "");
  const [region, setRegion] = useState(editGuild?.region ?? "eu");
  const [country, setCountry] = useState<string | null>(editGuild?.country ?? null);
  const [realm, setRealm] = useState(editGuild?.realm ?? "");
  const [faction, setFaction] = useState(editGuild?.faction ?? "");
  const [description, setDescription] = useState(editGuild?.description ?? "");
  const [culture, setCulture] = useState(editGuild?.culture ?? "");
  const [size, setSize] = useState(editGuild?.size?.toString() ?? "");
  const [languages, setLanguages] = useState<string[]>(editGuild?.languages ?? ["en"]);
  const [discordUrl, setDiscordUrl] = useState(editGuild?.discordUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(editGuild?.websiteUrl ?? "");

  // Raid team fields, only used when creating.
  const [teamName, setTeamName] = useState("Main raid");
  const [difficulty, setDifficulty] = useState("heroic");
  const [currentRaidId, setCurrentRaidId] = useState(RAIDS[0]?.id ?? "");
  const [currentBossesKilled, setCurrentBossesKilled] = useState("");
  const [currentProgression, setCurrentProgression] = useState("");
  const [previousProgression, setPreviousProgression] = useState("");
  const [availability, setAvailability] = useState<WeeklySlot[]>([]);
  const [timeZone, setTimeZone] = useState(guessTimeZone());
  const [voicePlatform, setVoicePlatform] = useState("discord");
  const [attendance, setAttendance] = useState("");
  const [trialDuration, setTrialDuration] = useState("");
  const [lootPolicy, setLootPolicy] = useState("");
  const [benchPolicy, setBenchPolicy] = useState("");
  const [expectations, setExpectations] = useState("");
  const [positions, setPositions] = useState<PositionDraft[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addPosition() {
    setPositions((p) => [
      ...p,
      { key: Date.now(), role: "DPS", preferredSpecIds: [], recruitmentType: "core", priority: 0 },
    ]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const num = (v: string) => (v.trim() === "" ? null : Number(v));

    const guildPayload = {
      name: name.trim(),
      region,
      country,
      realm: realm.trim() || null,
      faction: faction || null,
      description: description.trim() || null,
      culture: culture.trim() || null,
      size: num(size),
      languages,
      discordUrl: discordUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
    };

    try {
      if (editing) {
        await apiPost(`/api/guilds/${editGuild!.id}`, guildPayload, "PATCH");
        router.push(`/guilds/${editGuild!.id}`);
        return;
      }

      const { id } = await apiPost<{ id: string }>("/api/guilds", guildPayload);

      // The team create is a second request on purpose: it needs the guild id,
      // and a failure here leaves a usable guild the owner can add a team to
      // rather than losing everything they typed.
      await apiPost(`/api/guilds/${id}/teams`, {
        name: teamName.trim() || "Main raid",
        difficulty,
        currentProgression: currentProgression.trim() || null,
        currentRaidId: currentBossesKilled ? currentRaidId : null,
        currentBossesKilled: num(currentBossesKilled),
        previousProgression: previousProgression.trim() || null,
        availability,
        timeZone: timeZone || null,
        voicePlatform,
        attendanceRequirement: num(attendance),
        trialDuration: trialDuration.trim() || null,
        lootPolicy: lootPolicy.trim() || null,
        benchPolicy: benchPolicy.trim() || null,
        expectations: expectations.trim() || null,
        requiredAddons: [],
        positions: positions.map((p) => ({
          role: p.role,
          preferredSpecIds: p.preferredSpecIds,
          acceptedSpecIds: [],
          recruitmentType: p.recruitmentType,
          priority: p.priority,
          isFilled: false,
        })),
      });

      router.push(`/guilds/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the guild.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="panel space-y-4 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">Guild</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guild name">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={inputClass} />
          </Field>
          <Field label="Realm">
            <input value={realm} onChange={(e) => setRealm(e.target.value)} maxLength={60} className={inputClass} />
          </Field>
          <Select label="Region" value={region} onChange={setRegion} options={REGION_OPTIONS} />
          <Select
            label="Faction"
            value={faction}
            onChange={setFaction}
            options={[
              { value: "Alliance", label: "Alliance" },
              { value: "Horde", label: "Horde" },
            ]}
            placeholder="Not relevant"
          />
          <Field label="Guild size" hint="Roughly how many members.">
            <input
              type="number"
              min={1}
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Country" hint="Optional. Shows a flag on your listing.">
            <CountrySelect value={country} onChange={setCountry} />
          </Field>
        </div>

        <MultiSelect label="Languages" values={languages} onChange={setLanguages} options={LANGUAGE_OPTIONS} />

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={3000}
            className={inputClass}
          />
        </Field>

        <Field label="Guild culture" hint="What you are actually like to raid with.">
          <textarea
            value={culture}
            onChange={(e) => setCulture(e.target.value)}
            rows={3}
            maxLength={2000}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discord link">
            <input
              type="url"
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.gg/..."
              className={inputClass}
            />
          </Field>
          <Field label="Website">
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {!editing && (
        <>
          <section className="panel space-y-4 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Raid team</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Team name">
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={60} className={inputClass} />
              </Field>
              <Select
                label="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={RAID_DIFFICULTY_OPTIONS}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label="Current raid"
                value={currentRaidId}
                onChange={setCurrentRaidId}
                options={RAIDS.map((r) => ({ value: r.id, label: r.name }))}
              />
              <Field label="Bosses killed" hint="Used for progression matching.">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={currentBossesKilled}
                  onChange={(e) => setCurrentBossesKilled(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Progression" hint='Free text, e.g. "6/8 M".'>
                <input
                  value={currentProgression}
                  onChange={(e) => setCurrentProgression(e.target.value)}
                  maxLength={100}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Previous tier">
              <input
                value={previousProgression}
                onChange={(e) => setPreviousProgression(e.target.value)}
                maxLength={100}
                className={inputClass}
              />
            </Field>

            <AvailabilityPicker value={availability} onChange={setAvailability} label="Raid nights" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Time zone"
                value={timeZone}
                onChange={setTimeZone}
                options={TIMEZONE_OPTIONS}
                placeholder="Not set"
              />
              <Select
                label="Voice platform"
                value={voicePlatform}
                onChange={setVoicePlatform}
                options={VOICE_PLATFORM_OPTIONS}
              />
              <Field label="Attendance required" hint="Percent.">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={attendance}
                  onChange={(e) => setAttendance(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Trial duration">
                <input
                  value={trialDuration}
                  onChange={(e) => setTrialDuration(e.target.value)}
                  placeholder="e.g. 2 weeks"
                  maxLength={60}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Loot policy">
                <input value={lootPolicy} onChange={(e) => setLootPolicy(e.target.value)} maxLength={1000} className={inputClass} />
              </Field>
              <Field label="Bench policy">
                <input value={benchPolicy} onChange={(e) => setBenchPolicy(e.target.value)} maxLength={1000} className={inputClass} />
              </Field>
            </div>

            <Field label="Expectations">
              <textarea
                value={expectations}
                onChange={(e) => setExpectations(e.target.value)}
                rows={3}
                maxLength={2000}
                className={inputClass}
              />
            </Field>
          </section>

          <section className="panel space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Open positions</h2>
              <button type="button" onClick={addPosition} className="btn-ghost">
                Add position
              </button>
            </div>

            {!positions.length && (
              <p className="text-sm text-gray-500">
                Add at least one position so raiders know what you need.
              </p>
            )}

            {positions.map((p) => (
              <div key={p.key} className="rounded-lg border border-panelborder p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <FilterGroup label="Role">
                    {ROLES.map((r) => (
                      <FilterChip
                        key={r}
                        label={ROLE_LABEL[r]}
                        selected={p.role === r}
                        onClick={() =>
                          setPositions((all) =>
                            all.map((x) => (x.key === p.key ? { ...x, role: r, preferredSpecIds: [] } : x))
                          )
                        }
                      />
                    ))}
                  </FilterGroup>
                  <button
                    type="button"
                    onClick={() => setPositions((all) => all.filter((x) => x.key !== p.key))}
                    className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Recruitment type"
                    value={p.recruitmentType}
                    onChange={(v) =>
                      setPositions((all) => all.map((x) => (x.key === p.key ? { ...x, recruitmentType: v } : x)))
                    }
                    options={RAID_RECRUITMENT_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
                  />
                  <FilterGroup label="Priority">
                    <FilterChip
                      label="High priority"
                      selected={p.priority > 0}
                      onClick={() =>
                        setPositions((all) =>
                          all.map((x) => (x.key === p.key ? { ...x, priority: x.priority > 0 ? 0 : 1 } : x))
                        )
                      }
                    />
                    <FilterChip
                      label="Listed but closed"
                      selected={p.priority < 0}
                      onClick={() =>
                        setPositions((all) =>
                          all.map((x) => (x.key === p.key ? { ...x, priority: x.priority < 0 ? 0 : -1 } : x))
                        )
                      }
                    />
                  </FilterGroup>
                </div>

                <div className="mt-3">
                  <FilterGroup label="Preferred specs (leave empty for any)">
                    {ALL_SPECS.filter((s) => s.role === p.role).map((s) => (
                      <FilterChip
                        key={s.id}
                        label={
                          <span className="inline-flex items-center gap-1.5">
                            <SpecIcon specId={s.id} size={14} showRole={false} />
                            {s.name}
                          </span>
                        }
                        selected={p.preferredSpecIds.includes(s.id)}
                        onClick={() =>
                          setPositions((all) =>
                            all.map((x) =>
                              x.key === p.key
                                ? {
                                    ...x,
                                    preferredSpecIds: x.preferredSpecIds.includes(s.id)
                                      ? x.preferredSpecIds.filter((y) => y !== s.id)
                                      : [...x.preferredSpecIds, s.id],
                                  }
                                : x
                            )
                          )
                        }
                      />
                    ))}
                  </FilterGroup>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {error && (
        <p className="panel px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-gold">
          {busy ? "Saving..." : editing ? "Save changes" : "Publish guild"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
