"use client";

import { useState } from "react";
import Link from "next/link";
import type { TeamDTO } from "@/data/dto";
import { WowIcon } from "@/components/WowIcon";
import { TeamMembersModal } from "@/components/teams/TeamMembersModal";

/** The line directly under the profile banner. Three states, in precedence
 * order: an actual team wins over "looking for one", which wins over nothing.
 * `lftStatus` is simply not consulted while `team` is set. */
export function TeamStatusChip({
  team, lftStatus, viewerUserId, isOwnProfile,
}: {
  team: TeamDTO | null;
  lftStatus: string;
  viewerUserId: string | null;
  /** Adds the shortcut to /teams on the "looking for team" state. */
  isOwnProfile: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (team) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 pl-1 pr-3 py-1 hover:bg-gold/20 transition-colors"
          title="View the roster"
        >
          <WowIcon slug={team.iconSlug} size={22} cdnSize="medium" rounded="full" />
          <span className="text-xs font-bold text-gold">{team.name}</span>
          <span className="text-[10px] text-gray-400">
            {team.members.length} member{team.members.length === 1 ? "" : "s"}
          </span>
        </button>
        <TeamMembersModal team={team} open={open} onClose={() => setOpen(false)} viewerUserId={viewerUserId} />
      </>
    );
  }

  if (lftStatus === "lft") {
    const chip = (
      <span className="chip border border-accent/50 bg-accent/10 text-accent">Looking For Team</span>
    );
    return isOwnProfile ? <Link href="/teams">{chip}</Link> : chip;
  }

  return <span className="chip border border-panelborder text-gray-500">No Team</span>;
}
