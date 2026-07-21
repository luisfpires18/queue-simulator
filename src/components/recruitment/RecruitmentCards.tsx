"use client";

import { formatSlots } from "@/game/availability";
import { formatExpiry, formatListingAge, isStale } from "@/game/expiry";
import {
  ATMOSPHERE_LABEL,
  GOAL_LABEL,
  POST_TYPE_LABEL,
  RECRUITMENT_STATUS_LABEL,
  TEAM_MATURITY_LABEL,
  languageLabel,
  type Atmosphere,
  type TeamGoal,
  type TeamMaturity,
} from "@/game/recruitmentTypes";
// classById (not classColor) because classId arrives from the DB as a plain
// string - that helper exists for exactly this case.
import { classById, specById, type Role } from "@/game/classes";
import { countryByCode, flagUrl } from "@/game/countries";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import { RatingBadge } from "@/components/RatingBadge";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

/** Region + optional country flag. Region is the text (it is the part that
 * matters for matching); the flag is an extra, and always carries the country
 * name as a title so it is never colour/image alone. Same flagUrl the profile
 * uses - Windows has no flag-emoji glyphs. */
export function RegionFlag({ region, country }: { region: string; country: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-gray-600">Region</span>
      <span className="text-gray-300">{region.toUpperCase()}</span>
      {country && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flagUrl(country)}
          width={16}
          height={12}
          alt=""
          title={countryByCode(country)?.name ?? country}
          className="rounded-[2px]"
        />
      )}
    </span>
  );
}

/** Compact meta line item. Always label + value as text - colour alone never
 * carries meaning on these cards. */
function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-300">{value}</span>
    </span>
  );
}

function keyRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `+${min}` : `+${min} to +${max}`;
  if (min != null) return `+${min} and up`;
  return `up to +${max}`;
}

function StatusChip({ status }: { status: string }) {
  const label = RECRUITMENT_STATUS_LABEL[status as keyof typeof RECRUITMENT_STATUS_LABEL] ?? status;
  const tone =
    status === "open"
      ? "bg-accent/15 text-accent"
      : status === "filled"
        ? "bg-panel2 text-gray-400"
        : "bg-panel2 text-gray-500";
  return <span className={`chip ${tone}`}>{label}</span>;
}

/** A team-shaped recruitment post (team_lfp / group_lfm / new_team). */
export function TeamCard({
  post,
  onOpen,
  now = new Date(),
}: {
  post: MPlusRecruitmentPostDTO;
  onOpen: () => void;
  now?: Date;
}) {
  const open = post.positions.filter((p) => !p.isFilled);
  const schedule = formatSlots(post.availability);
  const current = keyRange(post.currentKeyMin, post.currentKeyMax);
  const target = keyRange(post.targetKeyMin, post.targetKeyMax);
  const stale = isStale(post, "mplus", now);

  return (
    <article className="panel p-4 text-left transition-colors hover:border-gray-600">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-white">{post.teamName || post.title}</h3>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {POST_TYPE_LABEL[post.postType as keyof typeof POST_TYPE_LABEL] ?? post.postType}
            </p>
          </div>
          <StatusChip status={post.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <RegionFlag region={post.region} country={post.country} />
          {post.languages.length > 0 && (
            <Meta label="Language" value={post.languages.map(languageLabel).join(", ")} />
          )}
          {current && <Meta label="Runs" value={current} />}
          {target && <Meta label="Target" value={target} />}
          <Meta label="Goal" value={GOAL_LABEL[post.goal as TeamGoal] ?? post.goal} />
        </div>

        {schedule && (
          <p className="mt-2 text-xs text-gray-400">
            {schedule}
            {post.timeZone && <span className="text-gray-600"> ({post.timeZone})</span>}
          </p>
        )}
      </button>

      {open.length > 0 && (
        <div className="mt-3 border-t border-panelborder pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
            Open positions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {open.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded border border-panelborder px-1.5 py-1 text-xs text-gray-300"
                title={`${ROLE_LABEL[p.role] ?? p.role}, ${p.isPermanent ? "permanent" : "substitute"}`}
              >
                <RoleIcon role={p.role as Role} size={14} title={ROLE_LABEL[p.role] ?? p.role} />
                {ROLE_LABEL[p.role] ?? p.role}
                {!p.isPermanent && <span className="text-gray-600">sub</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
        <span>{post.characters.length} on roster</span>
        <span>Posted {formatListingAge(post.createdAt, now).toLowerCase()}</span>
        {post.teamMaturity && <span>{TEAM_MATURITY_LABEL[post.teamMaturity as TeamMaturity]}</span>}
        {post.voiceRequired && <span>Voice required</span>}
        {stale && <span className="text-gray-500">{formatExpiry(post, now)}</span>}
      </div>
    </article>
  );
}

/** A player advertising themselves (postType "player_lft"). */
export function PlayerCard({
  post,
  onOpen,
  now = new Date(),
}: {
  post: MPlusRecruitmentPostDTO;
  onOpen: () => void;
  now?: Date;
}) {
  const entry = post.characters[0];
  const char = entry?.character;
  const spec = entry ? specById(entry.primarySpecId) : undefined;
  const schedule = formatSlots(post.availability);
  const current = keyRange(post.currentKeyMin, post.currentKeyMax);

  return (
    <article className="panel p-4 transition-colors hover:border-gray-600">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {entry && <SpecIcon specId={entry.primarySpecId} size={32} showRole title={spec?.name} />}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold" style={{ color: char ? classById(char.classId)?.color : undefined }}>
                {char?.name ?? post.title}
              </h3>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {spec?.name}
                {char && <span className="text-gray-600"> · {char.realm}</span>}
                {entry && !entry.isMain && <span className="text-gray-600"> · alt</span>}
              </p>
            </div>
          </div>
          {char?.rating != null && <RatingBadge rating={char.rating} size="sm" />}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Meta label="Role" value={ROLE_LABEL[entry?.preferredRole ?? ""] ?? entry?.preferredRole} />
          <RegionFlag region={post.region} country={post.country} />
          {post.languages.length > 0 && (
            <Meta label="Language" value={post.languages.map(languageLabel).join(", ")} />
          )}
          {current && <Meta label="Runs" value={current} />}
          <Meta label="Goal" value={GOAL_LABEL[post.goal as TeamGoal] ?? post.goal} />
        </div>

        {entry && entry.alternateSpecIds.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-600">Also plays</span>
            {entry.alternateSpecIds.map((id) => (
              <SpecIcon key={id} specId={id} size={18} title={specById(id)?.name} />
            ))}
          </div>
        )}

        {schedule && (
          <p className="mt-2 text-xs text-gray-400">
            {schedule}
            {post.timeZone && <span className="text-gray-600"> ({post.timeZone})</span>}
          </p>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
        <span>Posted {formatListingAge(post.createdAt, now).toLowerCase()}</span>
        {post.atmosphere && <span>{ATMOSPHERE_LABEL[post.atmosphere as Atmosphere]}</span>}
        <StatusChip status={post.status} />
      </div>
    </article>
  );
}
