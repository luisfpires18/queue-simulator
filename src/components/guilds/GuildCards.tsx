"use client";

import { formatSlots } from "@/game/availability";
import { formatListingAge } from "@/game/expiry";
import {
  ATMOSPHERE_LABEL,
  RAID_DIFFICULTY_LABEL,
  RAID_RECRUITMENT_TYPE_LABEL,
  languageLabel,
  type Atmosphere,
  type RaidDifficulty,
  type RaidRecruitmentType,
} from "@/game/recruitmentTypes";
import { classById, specById, type Role } from "@/game/classes";
import { RegionFlag } from "@/components/recruitment/RecruitmentCards";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import type { RaidTeamDTO, RaiderProfileDTO } from "@/data/recruitmentDto";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-300">{value}</span>
    </span>
  );
}

/** A raid team with openings. The unit of browsing is the TEAM, not the guild
 * - a raider is shopping for a roster with a spot on nights they can make. */
export function GuildCard({
  team,
  onOpen,
  now = new Date(),
}: {
  team: RaidTeamDTO;
  onOpen: () => void;
  now?: Date;
}) {
  const open = team.positions.filter((p) => !p.isFilled && p.priority >= 0);
  const schedule = formatSlots(team.availability);
  const highPriority = open.filter((p) => p.priority > 0);

  return (
    <article className="panel p-4 transition-colors hover:border-gray-600">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-white">{team.guild?.name ?? "Guild"}</h3>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {team.name}
              {team.guild?.realm && <span className="text-gray-600"> · {team.guild.realm}</span>}
            </p>
          </div>
          <span className="chip bg-panel2 text-gray-300">
            {RAID_DIFFICULTY_LABEL[team.difficulty as RaidDifficulty] ?? team.difficulty}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {team.guild && <RegionFlag region={team.guild.region} country={team.guild.country} />}
          {team.currentProgression && <Meta label="Progress" value={team.currentProgression} />}
          {team.guild && team.guild.languages.length > 0 && (
            <Meta label="Language" value={team.guild.languages.map(languageLabel).join(", ")} />
          )}
          {team.attendanceRequirement != null && (
            <Meta label="Attendance" value={`${team.attendanceRequirement}%`} />
          )}
        </div>

        {schedule && (
          <p className="mt-2 text-xs text-gray-400">
            {schedule}
            {team.timeZone && <span className="text-gray-600"> ({team.timeZone})</span>}
          </p>
        )}
      </button>

      {open.length > 0 && (
        <div className="mt-3 border-t border-panelborder pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
            Recruiting
          </p>
          <div className="flex flex-wrap gap-1.5">
            {open.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded border border-panelborder px-1.5 py-1 text-xs text-gray-300"
                title={`${ROLE_LABEL[p.role] ?? p.role}, ${RAID_RECRUITMENT_TYPE_LABEL[p.recruitmentType as RaidRecruitmentType] ?? p.recruitmentType}`}
              >
                <RoleIcon role={p.role as Role} size={14} title={ROLE_LABEL[p.role] ?? p.role} />
                {ROLE_LABEL[p.role] ?? p.role}
                <span className="text-gray-600">
                  {RAID_RECRUITMENT_TYPE_LABEL[p.recruitmentType as RaidRecruitmentType] ?? p.recruitmentType}
                </span>
              </span>
            ))}
          </div>
          {highPriority.length > 0 && (
            <p className="mt-2 text-[11px] text-accent">
              High priority: {highPriority.map((p) => ROLE_LABEL[p.role] ?? p.role).join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
        <span>Posted {formatListingAge(team.createdAt, now).toLowerCase()}</span>
        {team.trialDuration && <span>Trial: {team.trialDuration}</span>}
      </div>
    </article>
  );
}

/** A raider advertising for a guild. */
export function RaiderCard({
  profile,
  onOpen,
  now = new Date(),
}: {
  profile: RaiderProfileDTO;
  onOpen: () => void;
  now?: Date;
}) {
  const spec = specById(profile.primarySpecId);
  const schedule = formatSlots(profile.availability);

  return (
    <article className="panel p-4 transition-colors hover:border-gray-600">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <div className="flex items-start gap-2.5">
          <SpecIcon specId={profile.primarySpecId} size={32} showRole title={spec?.name} />
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-sm font-bold"
              style={{ color: classById(profile.character.classId)?.color }}
            >
              {profile.character.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {spec?.name} · {profile.character.realm}
            </p>
          </div>
          <span className="chip bg-panel2 text-gray-300">
            {RAID_DIFFICULTY_LABEL[profile.preferredDifficulty as RaidDifficulty] ?? profile.preferredDifficulty}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Meta label="Role" value={ROLE_LABEL[profile.preferredRole] ?? profile.preferredRole} />
          <RegionFlag region={profile.region} country={profile.country} />
          {profile.languages.length > 0 && (
            <Meta label="Language" value={profile.languages.map(languageLabel).join(", ")} />
          )}
          {profile.currentProgression && <Meta label="Progress" value={profile.currentProgression} />}
          {profile.attendanceExpectation != null && (
            <Meta label="Attendance" value={`${profile.attendanceExpectation}%`} />
          )}
        </div>

        {profile.offRoles.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            Can also play {profile.offRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}
          </p>
        )}

        {schedule && (
          <p className="mt-2 text-xs text-gray-400">
            {schedule}
            {profile.timeZone && <span className="text-gray-600"> ({profile.timeZone})</span>}
          </p>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
        <span>Posted {formatListingAge(profile.createdAt, now).toLowerCase()}</span>
        {profile.trialAvailable && <span>Available to trial</span>}
        {profile.atmosphere && <span>{ATMOSPHERE_LABEL[profile.atmosphere as Atmosphere]}</span>}
      </div>
    </article>
  );
}
