"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CurrentSelectionDTO, MyTeamApplicationStateDTO, TeamDTO } from "@/data/dto";
import type { Role } from "@/game/classes";
import {
  MAX_REQ_RATING_FILTER, teamMatchesMaxRating, teamMatchesRoles, teamMatchesSpecs,
} from "@/game/teamFilters";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { ROLE_LABEL } from "@/components/GroupFormShared";
import { RoleIcon } from "@/components/RoleIcon";
import { SpecPicker } from "@/components/board/SpecPicker";
import { PaginationChips } from "@/components/ui/PaginationChips";
import { TeamCard } from "./TeamCard";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;
const ROLES: Role[] = ["TANK", "HEALER", "DPS"];

// Sets need explicit (de)serialization for localStorage - same options the
// M+ board's filters pass.
const SET_JSON = {
  toJSON: (s: Set<string>) => [...s],
  fromJSON: (v: unknown) => new Set(Array.isArray(v) ? (v as string[]) : []),
};

/** Board state is plain component state seeded from the server render - a
 * team listing changes on the order of days, so it gets a `router.refresh()`
 * after actions rather than the key board's 4s SSE stream. */
export function TeamBoardClient({
  initial, current, canApply, loggedIn, viewerUserId, myTeam, initialMyApps, initialPendingCounts,
}: {
  initial: TeamDTO[];
  current: CurrentSelectionDTO | null;
  /** Signed in AND has a character selected - applying/creating needs both. */
  canApply: boolean;
  loggedIn: boolean;
  viewerUserId: string | null;
  /** The viewer's own team, if any. Passed in rather than found in `initial`
   * because a full roster is unlisted - it's absent from the board but still
   * theirs to see and manage. */
  myTeam: TeamDTO | null;
  initialMyApps: Record<string, MyTeamApplicationStateDTO>;
  /** Pending-application counts for the viewer's own team only, so the badge
   * is in the first paint (see getPendingCountsByTeam). */
  initialPendingCounts?: Record<string, number>;
}) {
  const [teams, setTeams] = useState(initial);
  // Actions that change a roster (accept, leave, delist) call router.refresh(),
  // which re-renders the server page and hands us a fresh `initial` - without
  // this the board would keep showing the member counts it mounted with.
  useEffect(() => setTeams(initial), [initial]);

  const [roles, setRoles] = useLocalStorageState<Set<string>>("team-filters-roles-v1", new Set(), SET_JSON);
  const [specs, setSpecs] = useLocalStorageState<Set<string>>("team-filters-specs-v1", new Set(), SET_JSON);
  const [maxRating, setMaxRating] = useLocalStorageState("team-filters-maxrating-v1", MAX_REQ_RATING_FILTER);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Every listed team has at least one open spot - a full roster unlists
  // itself server-side - so there's nothing here to hide full teams with.
  const others = useMemo(
    () =>
      teams.filter(
        (t) =>
          t.id !== myTeam?.id &&
          teamMatchesRoles(t.slots, roles) &&
          teamMatchesSpecs(t.slots, specs) &&
          teamMatchesMaxRating(t, maxRating)
      ),
    [teams, myTeam, roles, specs, maxRating]
  );

  const totalPages = Math.max(1, Math.ceil(others.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const paged = others.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  const toggle = (set: Set<string>, apply: (next: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
    setPage(1);
  };

  const resetAll = () => {
    setRoles(new Set());
    setSpecs(new Set());
    setMaxRating(MAX_REQ_RATING_FILTER);
    setPage(1);
  };

  // Stable identity - TeamCard is memoized, and this is one of its props.
  const onDelisted = useCallback((teamId: string) => setTeams((prev) => prev.filter((t) => t.id !== teamId)), []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* filters */}
      <aside className="panel h-max lg:sticky lg:top-20">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 lg:hidden"
        >
          <span className="font-bold uppercase tracking-wide text-sm">Filters</span>
          <span className="text-gray-500 text-xs">{filtersOpen ? "▲" : "▼"}</span>
        </button>
        <div className={cn("p-4 space-y-5", !filtersOpen && "hidden", "lg:block")}>
          <div className="hidden lg:flex items-center justify-between">
            <h2 className="font-bold uppercase tracking-wide text-sm">Filters</h2>
            <button onClick={resetAll} className="text-xs text-gray-400 hover:text-white">reset all</button>
          </div>
          <button onClick={resetAll} className="lg:hidden text-xs text-gray-400 hover:text-white -mt-2">reset all</button>

          {/* recruiting role */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              Recruiting role
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => toggle(roles, setRoles, r)}
                  className={cn(
                    "flex items-center gap-1.5 chip border",
                    roles.has(r) ? "border-accent text-accent bg-accent/10" : "border-panelborder text-gray-400"
                  )}
                >
                  <RoleIcon role={r} size={14} rounded="sm" />
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* recruiting spec */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              Recruiting spec {specs.size > 0 && `(${specs.size})`}
            </label>
            <p className="text-[10px] text-gray-500 mb-2">
              Teams with an open spot for these. A spot with no ranked specs counts for any spec of its role.
            </p>
            <SpecPicker selected={specs} onToggle={(specId) => toggle(specs, setSpecs, specId)} />
          </div>

          {/* rating requirement */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              Required rating
            </label>
            <div className="text-sm font-bold tabular-nums mb-2 text-accent">
              {maxRating >= MAX_REQ_RATING_FILTER ? "Any" : `up to ${maxRating}`}
            </div>
            <input
              type="range"
              min={0}
              max={MAX_REQ_RATING_FILTER}
              step={100}
              value={maxRating}
              onChange={(e) => { setMaxRating(Number(e.target.value)); setPage(1); }}
              className="w-full accent-accent"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Teams with no minimum-rating requirement always show.
            </p>
          </div>

        </div>
      </aside>

      {/* teams */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">
            {others.length} team{others.length === 1 ? "" : "s"} listed
          </span>
          <div className="ml-auto">
            {myTeam ? (
              myTeam.ownerUserId === viewerUserId ? (
                <Link href={`/teams/list?edit=${myTeam.id}`} className="btn-ghost text-xs px-3 py-1.5">
                  Manage my team
                </Link>
              ) : null
            ) : loggedIn ? (
              // Shown without a selected character too - /teams/list explains
              // how to sync a roster rather than leaving a dead end here.
              <Link href="/teams/list" className="btn-gold text-xs px-3 py-1.5">
                Start a team
              </Link>
            ) : null}
          </div>
        </div>

        {myTeam && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-gray-300">My team</span>
              {myTeam.slots.length === 0 && (
                <span className="chip border border-panelborder text-gray-500" title="A full roster isn't shown on the board. Free a spot and it's listed again.">
                  Full - not listed
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <TeamCard
                team={myTeam}
                current={current}
                canApply={canApply}
                viewerUserId={viewerUserId}
                initialMyApp={initialMyApps[myTeam.id]}
                initialPendingCount={initialPendingCounts?.[myTeam.id]}
                onDelisted={onDelisted}
              />
            </div>
          </div>
        )}

        {others.length === 0 ? (
          <div className="panel p-12 text-center">
            <div className="text-4xl mb-3">🛡️</div>
            {teams.filter((t) => t.id !== myTeam?.id).length === 0 ? (
              <>
                <p className="text-gray-300 font-semibold">No teams recruiting right now.</p>
                <p className="text-gray-500 text-sm mt-1">
                  {loggedIn ? "Be the first - hit “Start a team”." : "Log in with Battle.net to start one."}
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-300 font-semibold">No teams match your filters.</p>
                <button onClick={resetAll} className="text-accent text-sm mt-1 hover:underline">reset all</button>
              </>
            )}
          </div>
        ) : (
          <div>
            {myTeam && (
              <div className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-300">
                Other Teams ({others.length})
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {paged.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  current={current}
                  canApply={canApply}
                  viewerUserId={viewerUserId}
                  initialMyApp={initialMyApps[t.id]}
                  initialPendingCount={initialPendingCounts?.[t.id]}
                  onDelisted={onDelisted}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <PaginationChips
                page={pageClamped}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="mt-4"
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
