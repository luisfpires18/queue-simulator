"use client";

import { formatSlots, formatWeeklyLoad } from "@/game/availability";
import { formatExpiry, formatListingAge } from "@/game/expiry";
import {
  ATMOSPHERE_LABEL,
  GOAL_LABEL,
  POST_TYPE_LABEL,
  RECRUITMENT_STATUS_LABEL,
  TEAM_MATURITY_LABEL,
  TEAM_ROLE_LABEL,
  VOICE_PLATFORM_LABEL,
  languageLabel,
  type Atmosphere,
  type TeamGoal,
  type TeamMaturity,
  type TeamRole,
} from "@/game/recruitmentTypes";
// classById (not classColor) because classId arrives from the DB as a plain
// string - that helper exists for exactly this case.
import { classById, specById, type Role } from "@/game/classes";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import { RatingBadge } from "@/components/RatingBadge";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";

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

function keyRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `+${min}` : `+${min} to +${max}`;
  if (min != null) return `+${min} and up`;
  return `up to +${max}`;
}

/** The full read of a recruitment post - everything the compact card leaves
 * out. Rendered inside a Drawer from browse, and standalone on the detail
 * page. */
export function PostDetail({
  post,
  now = new Date(),
  applySlot,
}: {
  post: MPlusRecruitmentPostDTO;
  now?: Date;
  /** Rendered at the foot of the detail. The full page passes an ApplySection;
   * the browse drawer passes nothing and links to the page instead. */
  applySlot?: React.ReactNode;
}) {
  const openPositions = post.positions.filter((p) => !p.isFilled);
  const filledPositions = post.positions.filter((p) => p.isFilled);
  const schedule = formatSlots(post.availability);
  const load = formatWeeklyLoad(post.availability);

  return (
    <div>
      <Section title="Overview">
        <div className="panel px-3 py-1">
          <Row label="Type" value={POST_TYPE_LABEL[post.postType as keyof typeof POST_TYPE_LABEL]} />
          <Row label="Status" value={RECRUITMENT_STATUS_LABEL[post.status as keyof typeof RECRUITMENT_STATUS_LABEL]} />
          <Row label="Region" value={post.region.toUpperCase()} />
          <Row label="Languages" value={post.languages.map(languageLabel).join(", ")} />
          <Row label="Goal" value={GOAL_LABEL[post.goal as TeamGoal]} />
          <Row label="Current keys" value={keyRange(post.currentKeyMin, post.currentKeyMax)} />
          <Row label="Target keys" value={keyRange(post.targetKeyMin, post.targetKeyMax)} />
          <Row
            label="Team"
            value={post.teamMaturity ? TEAM_MATURITY_LABEL[post.teamMaturity as TeamMaturity] : null}
          />
          <Row
            label="Atmosphere"
            value={post.atmosphere ? ATMOSPHERE_LABEL[post.atmosphere as Atmosphere] : null}
          />
          <Row
            label="Voice"
            value={
              post.voiceRequired
                ? `Required${post.voicePlatform ? ` (${VOICE_PLATFORM_LABEL[post.voicePlatform] ?? post.voicePlatform})` : ""}`
                : "Not required"
            }
          />
          <Row label="Posted" value={formatListingAge(post.createdAt, now)} />
          <Row label="Expiry" value={formatExpiry(post, now)} />
        </div>
      </Section>

      {post.description && (
        <Section title="About">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{post.description}</p>
        </Section>
      )}

      {schedule && (
        <Section title="Schedule">
          <p className="text-sm text-gray-200">{schedule}</p>
          <p className="mt-1 text-xs text-gray-500">
            {post.timeZone ?? "Timezone not set"}
            {load && ` · ${load}`}
          </p>
        </Section>
      )}

      {openPositions.length > 0 && (
        <Section title={`Open positions (${openPositions.length})`}>
          <div className="space-y-2">
            {openPositions.map((p) => (
              <div key={p.id} className="panel p-3">
                <div className="flex items-center gap-2">
                  <RoleIcon role={p.role as Role} size={18} title={ROLE_LABEL[p.role]} />
                  <span className="text-sm font-semibold text-white">{ROLE_LABEL[p.role] ?? p.role}</span>
                  <span className="chip bg-panel2 text-gray-400">
                    {p.isPermanent ? "Permanent" : "Substitute"}
                  </span>
                  {p.isFlexible && <span className="chip bg-panel2 text-gray-400">Role flexible</span>}
                  {p.priority > 0 && <span className="chip bg-accent/15 text-accent">High priority</span>}
                </div>

                {p.preferredSpecIds.length > 0 && (
                  <SpecRow label="Preferred" specIds={p.preferredSpecIds} />
                )}
                {p.acceptedSpecIds.length > 0 && <SpecRow label="Also accepts" specIds={p.acceptedSpecIds} />}
                {!p.preferredSpecIds.length && !p.acceptedSpecIds.length && (
                  <p className="mt-2 text-xs text-gray-500">Any spec in this role.</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {filledPositions.length > 0 && (
        <Section title="Filled positions">
          <div className="flex flex-wrap gap-1.5">
            {filledPositions.map((p) => (
              <span key={p.id} className="chip bg-panel2 text-gray-500">
                {ROLE_LABEL[p.role] ?? p.role} filled
              </span>
            ))}
          </div>
        </Section>
      )}

      {post.characters.length > 0 && (
        <Section title={post.postType === "player_lft" ? "Character" : `Roster (${post.characters.length})`}>
          <div className="space-y-2">
            {post.characters.map((c) => {
              const spec = specById(c.primarySpecId);
              return (
                <div key={c.id} className="panel flex items-center gap-3 p-3">
                  <SpecIcon specId={c.primarySpecId} size={32} showRole title={spec?.name} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: classById(c.character.classId)?.color }}
                    >
                      {c.character.name}
                      {c.isMain && <span className="ml-1.5 text-[11px] text-gray-500">main</span>}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {spec?.name} · {c.character.realm}
                      {c.teamRole && ` · ${TEAM_ROLE_LABEL[c.teamRole as TeamRole]}`}
                    </p>
                    {c.alternateSpecIds.length > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[11px] text-gray-600">Alt specs</span>
                        {c.alternateSpecIds.map((id) => (
                          <SpecIcon key={id} specId={id} size={16} title={specById(id)?.name} />
                        ))}
                      </div>
                    )}
                  </div>
                  {c.character.rating != null && <RatingBadge rating={c.character.rating} size="sm" />}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* The apply call-to-action is rendered by the page, not here: this
          component is also used inside the browse drawer, where the viewer's
          own characters and application state are not loaded. */}
      {applySlot}
    </div>
  );
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
