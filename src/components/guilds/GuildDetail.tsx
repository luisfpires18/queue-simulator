"use client";

import { formatSlots, formatWeeklyLoad } from "@/game/availability";
import { formatExpiry, formatListingAge } from "@/game/expiry";
import {
  ATMOSPHERE_LABEL,
  BOSS_STATE_LABEL,
  COMPETITIVE_LEVEL_LABEL,
  RAID_DIFFICULTY_LABEL,
  RAID_RECRUITMENT_TYPE_LABEL,
  VOICE_PLATFORM_LABEL,
  languageLabel,
  type Atmosphere,
  type BossExperienceState,
  type RaidDifficulty,
  type RaidRecruitmentType,
} from "@/game/recruitmentTypes";
import { classById, specById, type Role } from "@/game/classes";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import type { GuildDTO, RaidTeamDTO, RaiderProfileDTO } from "@/data/recruitmentDto";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-panelborder/60 py-1.5 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-right text-sm text-gray-200">{value}</span>
    </div>
  );
}

/** Full read of one raid team plus the guild that owns it. */
export function RaidTeamDetail({
  team,
  guild,
  now = new Date(),
  applySlot,
}: {
  team: RaidTeamDTO;
  guild?: GuildDTO | null;
  now?: Date;
  applySlot?: React.ReactNode;
}) {
  const g = guild ?? team.guild;
  const open = team.positions.filter((p) => !p.isFilled && p.priority >= 0);
  const closed = team.positions.filter((p) => p.priority < 0);
  const schedule = formatSlots(team.availability);

  return (
    <div>
      <Section title="Guild">
        <div className="panel px-3 py-1">
          <Row label="Name" value={g?.name} />
          <Row label="Realm" value={g?.realm} />
          <Row label="Region" value={g?.region?.toUpperCase()} />
          <Row label="Faction" value={g?.faction} />
          <Row label="Languages" value={g?.languages.map(languageLabel).join(", ")} />
          {guild?.size != null && <Row label="Size" value={`${guild.size} members`} />}
        </div>
        {guild?.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{guild.description}</p>
        )}
      </Section>

      {guild?.culture && (
        <Section title="Guild culture">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{guild.culture}</p>
        </Section>
      )}

      <Section title="Raid team">
        <div className="panel px-3 py-1">
          <Row label="Team" value={team.name} />
          <Row label="Difficulty" value={RAID_DIFFICULTY_LABEL[team.difficulty as RaidDifficulty]} />
          <Row label="Current progression" value={team.currentProgression} />
          <Row label="Previous tier" value={team.previousProgression} />
          <Row
            label="Attendance"
            value={team.attendanceRequirement != null ? `${team.attendanceRequirement}% required` : null}
          />
          <Row label="Trial" value={team.trialDuration} />
          <Row
            label="Voice"
            value={team.voicePlatform ? VOICE_PLATFORM_LABEL[team.voicePlatform] ?? team.voicePlatform : null}
          />
          <Row label="Posted" value={formatListingAge(team.createdAt, now)} />
          <Row label="Expiry" value={formatExpiry(team, now)} />
        </div>
      </Section>

      {schedule && (
        <Section title="Raid nights">
          <p className="text-sm text-gray-200">{schedule}</p>
          <p className="mt-1 text-xs text-gray-500">
            {team.timeZone ?? "Timezone not set"}
            {formatWeeklyLoad(team.availability) && ` · ${formatWeeklyLoad(team.availability)}`}
          </p>
        </Section>
      )}

      {open.length > 0 && (
        <Section title={`Open positions (${open.length})`}>
          <div className="space-y-2">
            {open.map((p) => (
              <div key={p.id} className="panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RoleIcon role={p.role as Role} size={18} title={ROLE_LABEL[p.role]} />
                  <span className="text-sm font-semibold text-white">{ROLE_LABEL[p.role] ?? p.role}</span>
                  <span className="chip bg-panel2 text-gray-400">
                    {RAID_RECRUITMENT_TYPE_LABEL[p.recruitmentType as RaidRecruitmentType] ?? p.recruitmentType}
                  </span>
                  {p.priority > 0 && <span className="chip bg-accent/15 text-accent">High priority</span>}
                </div>
                {p.preferredSpecIds.length > 0 && <SpecRow label="Preferred" specIds={p.preferredSpecIds} />}
                {p.acceptedSpecIds.length > 0 && <SpecRow label="Also accepts" specIds={p.acceptedSpecIds} />}
                {!p.preferredSpecIds.length && !p.acceptedSpecIds.length && (
                  <p className="mt-2 text-xs text-gray-500">Any spec in this role.</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Not currently recruiting">
          <div className="flex flex-wrap gap-1.5">
            {closed.map((p) => (
              <span key={p.id} className="chip bg-panel2 text-gray-500">
                {ROLE_LABEL[p.role] ?? p.role}
              </span>
            ))}
          </div>
        </Section>
      )}

      {(team.expectations || team.lootPolicy || team.benchPolicy || team.requiredAddons.length > 0) && (
        <Section title="Expectations">
          <div className="panel px-3 py-1">
            <Row label="Loot" value={team.lootPolicy} />
            <Row label="Bench" value={team.benchPolicy} />
            <Row label="Addons" value={team.requiredAddons.join(", ")} />
          </div>
          {team.expectations && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
              {team.expectations}
            </p>
          )}
        </Section>
      )}

      {(guild?.discordUrl || guild?.websiteUrl) && (
        <Section title="Contact">
          <div className="flex flex-wrap gap-2">
            {guild.discordUrl && <ExternalLink href={guild.discordUrl} label="Discord" />}
            {guild.websiteUrl && <ExternalLink href={guild.websiteUrl} label="Website" />}
          </div>
        </Section>
      )}

      {/* Rendered by the page rather than here: the browse drawer reuses this
          component without the viewer's characters or application state. */}
      {applySlot}
    </div>
  );
}

/** Full read of a raider looking for a guild. */
export function RaiderDetail({ profile, now = new Date() }: { profile: RaiderProfileDTO; now?: Date }) {
  const spec = specById(profile.primarySpecId);
  const schedule = formatSlots(profile.availability);

  // Grouped by raid so a guild reads "this tier" rather than a flat list.
  const byRaid = new Map<string, typeof profile.bossExperience>();
  for (const b of profile.bossExperience) {
    const list = byRaid.get(b.raidId) ?? [];
    list.push(b);
    byRaid.set(b.raidId, list);
  }

  return (
    <div>
      <Section title="Raider">
        <div className="panel flex items-center gap-3 p-3">
          <SpecIcon specId={profile.primarySpecId} size={36} showRole title={spec?.name} />
          <div className="min-w-0">
            <p
              className="truncate text-sm font-bold"
              style={{ color: classById(profile.character.classId)?.color }}
            >
              {profile.character.name}
            </p>
            <p className="truncate text-xs text-gray-500">
              {spec?.name} · {profile.character.realm}
              {profile.character.ilvl != null && ` · ilvl ${profile.character.ilvl}`}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Details">
        <div className="panel px-3 py-1">
          <Row label="Preferred role" value={ROLE_LABEL[profile.preferredRole]} />
          <Row
            label="Off-roles"
            value={profile.offRoles.length ? profile.offRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ") : null}
          />
          <Row
            label="Difficulty"
            value={RAID_DIFFICULTY_LABEL[profile.preferredDifficulty as RaidDifficulty]}
          />
          <Row label="Region" value={profile.region.toUpperCase()} />
          <Row label="Languages" value={profile.languages.map(languageLabel).join(", ")} />
          <Row label="Current progression" value={profile.currentProgression} />
          <Row label="Previous tier" value={profile.previousProgression} />
          <Row
            label="Attendance"
            value={profile.attendanceExpectation != null ? `${profile.attendanceExpectation}%` : null}
          />
          <Row label="Voice" value={profile.voiceAvailable ? "Available" : "Not available"} />
          <Row label="Transfer" value={profile.transferWilling ? "Willing to transfer" : null} />
          <Row label="Faction" value={profile.factionFlexible ? "Flexible" : null} />
          <Row label="Trial" value={profile.trialAvailable ? "Available to trial" : null} />
          <Row
            label="Atmosphere"
            value={profile.atmosphere ? ATMOSPHERE_LABEL[profile.atmosphere as Atmosphere] : null}
          />
          <Row
            label="Level"
            value={
              profile.competitiveLevel ? COMPETITIVE_LEVEL_LABEL[profile.competitiveLevel] ?? profile.competitiveLevel : null
            }
          />
          <Row label="Posted" value={formatListingAge(profile.createdAt, now)} />
        </div>
      </Section>

      {profile.alternateSpecIds.length > 0 && (
        <Section title="Alternate specs">
          <SpecRow label="Can play" specIds={profile.alternateSpecIds} />
        </Section>
      )}

      {schedule && (
        <Section title="Availability">
          <p className="text-sm text-gray-200">{schedule}</p>
          <p className="mt-1 text-xs text-gray-500">{profile.timeZone ?? "Timezone not set"}</p>
        </Section>
      )}

      {byRaid.size > 0 && (
        <Section title="Boss experience">
          {[...byRaid.entries()].map(([raidId, bosses]) => (
            <div key={raidId} className="mb-3">
              <p className="mb-1.5 text-xs text-gray-500">{raidId}</p>
              <div className="flex flex-wrap gap-1.5">
                {bosses.map((b, i) => (
                  <span
                    key={`${b.bossId}-${b.difficulty}-${i}`}
                    className="rounded border border-panelborder px-1.5 py-1 text-xs text-gray-300"
                    title={describeBoss(b.state, b.difficulty, b.phaseReached, b.kills)}
                  >
                    {b.bossId}
                    <span className="ml-1 text-gray-600">
                      {RAID_DIFFICULTY_LABEL[b.difficulty]} · {BOSS_STATE_LABEL[b.state as BossExperienceState]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {profile.introduction && (
        <Section title="Introduction">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{profile.introduction}</p>
        </Section>
      )}
    </div>
  );
}

function describeBoss(state: string, difficulty: string, phase?: number, kills?: number): string {
  const d = RAID_DIFFICULTY_LABEL[difficulty as RaidDifficulty] ?? difficulty;
  if (state === "progressed") return phase ? `Reached phase ${phase} on ${d}` : `Progression experience on ${d}`;
  if (state === "killed") return `Killed ${d}${kills ? ` ${kills} times` : ""}`;
  if (state === "farm") return `Farm experience on ${d}`;
  return `Not attempted on ${d}`;
}

function SpecRow({ label, specIds }: { label: string; specIds: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-gray-600">{label}</span>
      {specIds.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 text-xs text-gray-300">
          <SpecIcon specId={id} size={16} title={specById(id)?.name} />
          {specById(id)?.name ?? id}
        </span>
      ))}
    </div>
  );
}

/** External links are user-supplied, so they carry noopener/noreferrer and are
 * shown as the raw host rather than arbitrary anchor text. */
function ExternalLink({ href, label }: { href: string; label: string }) {
  let host = href;
  try {
    host = new URL(href).host;
  } catch {
    /* keep the raw string if it will not parse */
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="btn-ghost"
      title={href}
    >
      {label}
      <span className="text-gray-600">{host}</span>
    </a>
  );
}
