"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import type { CurrentSelectionDTO, MyTeamApplicationStateDTO, OpenSlot, TeamDTO, TeamMemberDTO } from "@/data/dto";
import { CLASS_BY_ID, specById, type Role } from "@/game/classes";
import { languageByCode } from "@/game/languages";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { requirementChipLabel } from "@/lib/format";
import { useMyTeamApplication } from "@/lib/queries";
import { ROLE_LABEL } from "@/components/GroupFormShared";
import { RoleIcon } from "@/components/RoleIcon";
import { SpecIcon } from "@/components/SpecIcon";
import { WowIcon } from "@/components/WowIcon";
import { cn } from "@/lib/utils";

// Code-split: click-gated modals shouldn't ship in the main bundle for a
// board that renders one TeamCard per listing. ssr: false since each is
// invisible (returns null) until its own `open` prop flips true anyway.
const TeamApplyModal = dynamic(() => import("./TeamApplyModal").then((m) => m.TeamApplyModal), { ssr: false });
const TeamMembersModal = dynamic(() => import("./TeamMembersModal").then((m) => m.TeamMembersModal), { ssr: false });
const TeamPendingRequestsModal = dynamic(() => import("./TeamPendingRequestsModal").then((m) => m.TeamPendingRequestsModal), { ssr: false });
const ConfirmDialog = dynamic(() => import("@/components/ConfirmDialog").then((m) => m.ConfirmDialog), { ssr: false });

const ROLE_BORDER: Record<string, string> = {
  TANK: "border-sky-400/40",
  HEALER: "border-emerald-400/40",
  DPS: "border-rose-400/40",
};

/** A member already on the roster - their spec icon and name, crowned for the
 * team leader. Same square as a filled slot on a key listing. */
function FilledSpot({ member }: { member: TeamMemberDTO }) {
  const sp = member.specId ? specById(member.specId) : null;
  const color = sp ? CLASS_BY_ID[sp.classId]?.color : undefined;
  return (
    <div className="flex flex-col items-center gap-1 w-12 sm:w-14">
      <div className="relative rounded-md p-0.5" style={{ background: color ? `${color}22` : undefined }}>
        {member.isOwner && (
          <span className="absolute -top-1 -left-1 text-[11px] leading-none z-10" title="Team leader">
            👑
          </span>
        )}
        {member.specId ? (
          <SpecIcon specId={member.specId} size={42} />
        ) : (
          <RoleIcon role={member.role as Role} size={42} rounded="sm" />
        )}
      </div>
      <span className="text-[10px] text-gray-200 truncate w-full text-center">{member.characterName}</span>
    </div>
  );
}

/** One open recruiting spot: a role placeholder whose accepted specs live in
 * a hover/tap popover, same affordance as an open slot on a key listing. */
function OpenSpot({ slot }: { slot: OpenSlot }) {
  const [open, setOpen] = useState(false);
  const count = slot.prefs.length;
  return (
    <div className="group relative flex flex-col items-center gap-1 w-12 sm:w-14">
      <button
        type="button"
        onClick={() => count > 0 && setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className={cn(
          "relative w-[42px] h-[42px] rounded-md border border-dashed grid place-items-center bg-panel2/40",
          count > 0 && "cursor-pointer",
          ROLE_BORDER[slot.role]
        )}
      >
        <RoleIcon role={slot.role as Role} size={22} rounded="sm" className="grayscale opacity-60" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-accent text-black text-[9px] font-black px-1 leading-4 min-w-4 text-center">
            {count}
          </span>
        )}
      </button>
      <span className="text-[10px] text-gray-500">{ROLE_LABEL[slot.role as Role] ?? "open"}</span>

      {count > 0 && (
        <div
          className={cn(
            "hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-44 panel p-2 shadow-card",
            open && "!block"
          )}
        >
          <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">
            {ROLE_LABEL[slot.role as Role]} - accepts, in order
          </div>
          <ol className="space-y-1">
            {slot.prefs.map((id, i) => {
              const sp = specById(id);
              const cls = sp ? CLASS_BY_ID[sp.classId] : null;
              return (
                <li key={id} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-gray-500 w-2.5">{i + 1}</span>
                  <SpecIcon specId={id} size={20} showRole={false} />
                  <span className="text-[11px] truncate" style={{ color: cls?.color }}>{sp?.name}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function TeamCardInner({
  team, current, canApply, viewerUserId, initialMyApp, initialPendingCount, onDelisted,
}: {
  team: TeamDTO;
  current: CurrentSelectionDTO | null;
  canApply: boolean;
  viewerUserId: string | null;
  /** Server-rendered seed so the first paint shows the real button state. */
  initialMyApp?: MyTeamApplicationStateDTO;
  /** Server-rendered pending count for owners - keeps the badge out of the
   * "wait for a client fetch" path (see getPendingCountsByTeam). */
  initialPendingCount?: number;
  onDelisted?: (teamId: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = viewerUserId != null && viewerUserId === team.ownerUserId;
  const isMember = viewerUserId != null && team.members.some((m) => m.userId === viewerUserId);
  const requirementLabel = requirementChipLabel(team);
  const language = team.language ? languageByCode(team.language) : null;

  const { data: myAppData } = useMyTeamApplication(team.id, !isMember && canApply, initialMyApp);
  const myApp = myAppData?.application ?? null;
  const lastDecline = myAppData?.lastDecline ?? null;
  const declinedCount = myAppData?.declinedCount ?? 0;
  const outOfChances = myApp?.status === "declined" && declinedCount >= MAX_APPLICATION_DECLINES;

  async function delist() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (res.ok) onDelisted?.(team.id);
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const applyLabel = isMember
    ? "You're on this team"
    : myApp?.status === "pending"
      ? "Applied - Pending"
      : outOfChances
        ? "Declined twice"
        : myApp?.status === "declined"
          ? "Declined - Apply again"
          : team.slots.length === 0
            ? "Not recruiting"
            : "Apply";
  const applyDisabled = isMember || outOfChances || team.slots.length === 0 || !canApply;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start gap-3">
        <WowIcon slug={team.iconSlug} size={44} />
        <div className="min-w-0 flex-1">
          <button onClick={() => setMembersOpen(true)} className="text-left w-full">
            <div className="text-sm font-bold truncate hover:text-accent transition-colors">{team.name}</div>
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="chip border border-panelborder text-gray-400">
              {team.members.length} member{team.members.length === 1 ? "" : "s"}
            </span>
            {language && (
              <span className="chip border border-panelborder text-gray-300" title="Language spoken">
                {language.name}
              </span>
            )}
            {team.voiceChat && (
              <span className="chip border border-panelborder text-gray-300" title="Voice chat">
                🎧 {team.voiceChat}
              </span>
            )}
            {requirementLabel && (
              <span className="chip border border-gold/50 text-gold" title="Minimum rating is a hard gate on applying">
                {requirementLabel}
              </span>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="flex flex-col items-end gap-1.5">
            <button onClick={() => router.push(`/teams/list?edit=${team.id}`)} className="btn-ghost text-xs px-2 py-1">
              Edit
            </button>
            <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-xs px-2 py-1 text-rose-300">
              Delist
            </button>
          </div>
        )}
      </div>

      {team.description && <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap">{team.description}</p>}

      <div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
          {team.slots.length === 0 ? "Roster full" : "Roster"}
        </div>
        {/* Who's already in (leader first - teamDTO sorts them that way),
            then the spots still open. */}
        <div className="flex flex-wrap gap-2">
          {team.members.map((m) => (
            <FilledSpot key={m.userId} member={m} />
          ))}
          {team.slots.map((s, i) => (
            <OpenSpot key={`open-${i}`} slot={s} />
          ))}
        </div>
      </div>

      {/* Why they were turned down, where they'll actually look for it -
          without this the only copy of the reason is a push notification and
          a tab on their own profile. */}
      {lastDecline && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 space-y-1">
          <div className="text-[11px] text-rose-200">
            <span className="font-semibold">Declined:</span> {lastDecline.reasonLabel}
          </div>
          {lastDecline.note && <p className="text-[11px] text-gray-300 italic">&ldquo;{lastDecline.note}&rdquo;</p>}
          <p className="text-[11px] text-gray-500">
            {outOfChances
              ? "Declined twice - no more attempts."
              : `${MAX_APPLICATION_DECLINES - declinedCount} attempt${MAX_APPLICATION_DECLINES - declinedCount === 1 ? "" : "s"} left.`}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setMembersOpen(true)} className="btn-ghost text-xs px-2 py-1">
          Roster
        </button>
        {isOwner && (
          <TeamPendingRequestsModal
            teamId={team.id}
            initialCount={initialPendingCount}
            onResolved={() => {
              queryClient.invalidateQueries({ queryKey: ["my-team-application", team.id] });
              router.refresh();
            }}
          />
        )}
        {!isOwner && (
          <button
            onClick={() => setApplyOpen(true)}
            disabled={applyDisabled}
            className={cn("ml-auto text-xs px-3 py-1.5", applyDisabled ? "btn-ghost opacity-60" : "btn-gold")}
          >
            {applyLabel}
          </button>
        )}
      </div>

      <TeamApplyModal
        team={team}
        current={current}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={() => queryClient.invalidateQueries({ queryKey: ["my-team-application", team.id] })}
      />
      <TeamMembersModal team={team} open={membersOpen} onClose={() => setMembersOpen(false)} viewerUserId={viewerUserId} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delist this team?"
        message="The listing is removed and every member leaves the roster. This can't be undone."
        confirmLabel={deleting ? "Delisting…" : "Delist"}
        onConfirm={delist}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** Memoized: mirrors GroupCard - TeamBoardClient re-renders on every filter/
 * page change, and most of those don't touch any given card's own props. */
export const TeamCard = memo(TeamCardInner);
