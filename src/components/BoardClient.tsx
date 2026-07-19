"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CurrentSelectionDTO, GroupDTO, MyApplicationStateDTO, SoloQueueStatusDTO } from "@/data/dto";
import { GroupCard } from "./GroupCard";
import { SoloQueueClient } from "./SoloQueueClient";
import { SpecPicker } from "./board/SpecPicker";
import { useLiveBoard } from "./board/useLiveBoard";
import { PaginationChips } from "./ui/PaginationChips";
import { ROLE_LABEL } from "./GroupFormShared";
import { WowIcon } from "./WowIcon";
import { type Role } from "@/game/classes";
import { bloodlustFits } from "@/game/bloodlust";
import { DUNGEONS } from "@/game/season";
import { sortGroups, type BoardSortMode } from "@/lib/format";
import { cn } from "@/lib/utils";

const MIN_KEY = 2;
const MAX_KEY = 25;
const OTHERS_PAGE_SIZE = 10;
const ROLES: Role[] = ["TANK", "HEALER", "DPS"];
const ROLE_MAX: Record<Role, number> = { TANK: 1, HEALER: 1, DPS: 3 };

function RoleMaxSlider({
  role, value, onChange,
}: { role: Role; value: number; onChange: (v: number) => void }) {
  const max = ROLE_MAX[role];
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-gray-400">{ROLE_LABEL[role]}</span>
        <span className="text-accent font-bold tabular-nums">0–{value}</span>
      </div>
      <input
        type="range" min={0} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

export function BoardClient({
  initial, canList, current, viewerUserId, initialMyApps, initialSoloQueueStatus,
}: {
  initial: GroupDTO[];
  canList: boolean;
  current: CurrentSelectionDTO | null;
  viewerUserId: string | null;
  /** The viewer's application state per group, from the server render - see
   * getMyApplicationsByGroup. Seeds each card's Apply button so first paint
   * shows the real state instead of flashing "Apply". */
  initialMyApps?: Record<string, MyApplicationStateDTO>;
  /** The viewer's Solo Queue state, from the server render - see
   * getMySoloQueueStatus. Seeds SoloQueueClient so first paint shows
   * queued/matched instead of flashing "Find Group". */
  initialSoloQueueStatus?: SoloQueueStatusDTO;
}) {
  const { groups, live, removeGroup } = useLiveBoard(initial);
  const [lo, setLo] = useState(MIN_KEY);
  const [hi, setHi] = useState(MAX_KEY);
  const [dungeons, setDungeons] = useState<Set<string>>(new Set());
  const [roleMax, setRoleMax] = useState<Record<Role, number>>({ ...ROLE_MAX });
  const [excludeSpecs, setExcludeSpecs] = useState<Set<string>>(new Set());
  const [bloodlustFit, setBloodlustFit] = useState(false);
  const [sort, setSort] = useState<BoardSortMode>("newest");

  // Deep-link support: /runs?highlight=<groupId> (used by Solo Queue's "See
  // Key Listed" link after a match) jumps straight to that key regardless of
  // the visitor's current filters/pagination, and rings it briefly.
  // useSearchParams (not a mount-time window.location read): the Solo Queue
  // panel lives ON /runs, so its link is a same-route navigation that never
  // remounts this component - the param has to be read reactively or the
  // click updates the URL and nothing else.
  const highlightId = useSearchParams().get("highlight");

  const toggleDungeon = (id: string) =>
    setDungeons((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleExcludeSpec = (id: string) =>
    setExcludeSpecs((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const resetAll = () => {
    setLo(MIN_KEY); setHi(MAX_KEY);
    setDungeons(new Set());
    setRoleMax({ ...ROLE_MAX });
    setExcludeSpecs(new Set());
    setBloodlustFit(false);
  };

  const filtered = useMemo(
    () =>
      groups.filter((g) => {
        if (g.kind !== "mplus" || g.keyLevel == null || g.dungeonId == null) return false;
        if (g.keyLevel < lo || g.keyLevel > hi) return false;
        if (dungeons.size > 0 && !dungeons.has(g.dungeonId)) return false;

        for (const role of ROLES) {
          const count = g.members.filter((m) => m.role === role).length;
          if (count > roleMax[role]) return false;
        }

        if (excludeSpecs.size > 0) {
          const hasExcluded = g.members.some((m) => excludeSpecs.has(m.broughtSpecId ?? m.specId ?? ""));
          if (hasExcluded) return false;
        }

        if (bloodlustFit && !bloodlustFits(g)) return false;

        return true;
      }),
    [groups, lo, hi, dungeons, roleMax, excludeSpecs, bloodlustFit]
  );

  // pinned "your keys" (small, collapsible, no pagination) vs. everyone
  // else's (paginated — SSE already ships the full board, so this is a
  // client-side slice, not a server round-trip). Deliberately built from
  // unfiltered `groups`, not `filtered` - your own keys section shouldn't
  // disappear just because you're browsing with a narrower key-level range,
  // dungeon selection, etc. Only "others" respects the sidebar filters.
  const mine = useMemo(
    () =>
      sortGroups(
        viewerUserId
          ? groups.filter((g) => g.kind === "mplus" && g.keyLevel != null && g.dungeonId != null && g.ownerUserId === viewerUserId)
          : [],
        sort
      ),
    [groups, viewerUserId, sort]
  );
  const others = useMemo(
    () => sortGroups(filtered.filter((g) => g.ownerUserId !== viewerUserId), sort),
    [filtered, viewerUserId, sort]
  );
  // Unfiltered - "you have a key listed" shouldn't disappear just because
  // it's outside the current key-level/dungeon filters.
  const myActiveListingsCount = useMemo(
    () => (viewerUserId ? groups.filter((g) => g.ownerUserId === viewerUserId).length : 0),
    [groups, viewerUserId]
  );
  // Distinguishes "nobody else has listed anything" from "filters are
  // hiding everyone else's keys", for the others-empty-state message below.
  const anyOtherKeysExist = useMemo(
    () => groups.some((g) => g.kind === "mplus" && g.keyLevel != null && g.dungeonId != null && g.ownerUserId !== viewerUserId),
    [groups, viewerUserId]
  );
  const [mineOpen, setMineOpen] = useState(true);
  const [othersPage, setOthersPage] = useState(1);
  useEffect(() => {
    setOthersPage(1);
  }, [lo, hi, dungeons, roleMax, excludeSpecs, bloodlustFit, sort, others.length]);
  const othersTotalPages = Math.max(1, Math.ceil(others.length / OTHERS_PAGE_SIZE));
  const othersPageClamped = Math.min(othersPage, othersTotalPages);
  const othersPageItems = others.slice(
    (othersPageClamped - 1) * OTHERS_PAGE_SIZE,
    othersPageClamped * OTHERS_PAGE_SIZE
  );

  // Jump to a deep-linked group once it shows up in the live board data:
  // clear filters so nothing can hide it, flip to its page if it's in
  // "others", and expand "Your Keys" if it's there instead. Runs once per
  // highlight target - a new ?highlight= value re-arms it (the link can be
  // clicked again from the Solo Queue panel without a page reload).
  const highlightHandled = useRef(false);
  const lastHighlightId = useRef(highlightId);
  if (lastHighlightId.current !== highlightId) {
    lastHighlightId.current = highlightId;
    highlightHandled.current = false;
  }
  useEffect(() => {
    if (!highlightId || highlightHandled.current) return;
    const idx = others.findIndex((g) => g.id === highlightId);
    const inMine = mine.some((g) => g.id === highlightId);
    if (idx === -1 && !inMine) {
      // Filtered out, or the board just hasn't loaded it yet - if it's
      // genuinely present in the unfiltered list, clear filters and retry;
      // otherwise (bad link, delisted key) give up so this doesn't keep
      // resetting the visitor's filters on every board refresh.
      if (groups.some((g) => g.id === highlightId)) resetAll();
      else highlightHandled.current = true;
      return;
    }
    highlightHandled.current = true;
    if (idx !== -1) setOthersPage(Math.floor(idx / OTHERS_PAGE_SIZE) + 1);
    else setMineOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, others, mine, groups]);

  useEffect(() => {
    if (!highlightId || !highlightHandled.current) return;
    document.getElementById(`group-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, othersPageClamped, mineOpen]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* filters */}
      <aside className="panel p-4 h-max lg:sticky lg:top-20 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold uppercase tracking-wide text-sm">Filters</h2>
          <button onClick={resetAll} className="text-xs text-gray-400 hover:text-white">reset all</button>
        </div>

        {/* key range */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Key level
          </label>
          <div className="flex items-center justify-between text-sm font-bold tabular-nums mb-2">
            <span className="text-accent">+{lo}</span>
            <span className="text-gray-500">to</span>
            <span className="text-accent">+{hi}</span>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-gray-500">min</span>
              <input
                type="range" min={MIN_KEY} max={MAX_KEY} value={lo}
                onChange={(e) => setLo(Math.min(Number(e.target.value), hi))}
                className="w-full accent-accent"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-500">max</span>
              <input
                type="range" min={MIN_KEY} max={MAX_KEY} value={hi}
                onChange={(e) => setHi(Math.max(Number(e.target.value), lo))}
                className="w-full accent-accent"
              />
            </div>
          </div>
        </div>

        {/* dungeon */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Dungeon
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DUNGEONS.map((d) => {
              const on = dungeons.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDungeon(d.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-[11px]",
                    on ? "border-accent bg-accent/10 text-accent" : "border-panelborder text-gray-400"
                  )}
                >
                  <WowIcon slug={d.icon} size={24} cdnSize="small" rounded="sm" />
                  {d.abbr}
                </button>
              );
            })}
          </div>
        </div>

        {/* role counts */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Roles in group
          </label>
          <div className="space-y-3">
            {ROLES.map((role) => (
              <RoleMaxSlider
                key={role}
                role={role}
                value={roleMax[role]}
                onChange={(v) => setRoleMax((prev) => ({ ...prev, [role]: v }))}
              />
            ))}
          </div>
        </div>

        {/* exclude specs */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Exclude specs {excludeSpecs.size > 0 && `(${excludeSpecs.size})`}
          </label>
          <p className="text-[10px] text-gray-500 mb-2">Hide groups with a member already playing these.</p>
          <SpecPicker selected={excludeSpecs} onToggle={toggleExcludeSpec} />
        </div>

        {/* bloodlust fit check */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={bloodlustFit}
            onChange={(e) => setBloodlustFit(e.target.checked)}
            className="mt-0.5 accent-accent"
          />
          <span>
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Bloodlust fit check
            </span>
            <span className="block text-[10px] text-gray-500 mt-0.5">
              Only groups that already have Lust, or have an open DPS/Healer spot for a Lust class.
            </span>
          </span>
        </label>
      </aside>

      {/* groups */}
      <section className="space-y-6">
        {canList && current && (
          <div>
            <div className="mb-3">
              <div className="text-sm font-bold uppercase tracking-wide text-gray-300">Solo Queue</div>
              <p className="text-xs text-gray-500 mt-0.5">
                Queue up and the best-fit forming group's leader gets you proposed automatically - a decline is
                invisible to you, an accept drops you straight into the key.
              </p>
            </div>
            <div className="max-w-md">
              <SoloQueueClient current={current} minKeyLevel={lo} maxKeyLevel={hi} dungeonIds={[...dungeons]} initialStatus={initialSoloQueueStatus} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("h-2 w-2 rounded-full", live ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
          <span className="text-sm text-gray-400">
            {others.length} key{others.length === 1 ? "" : "s"} listed
          </span>
          {myActiveListingsCount > 0 && (
            <span className="text-sm text-amber-300">
              ⚠ You have {myActiveListingsCount} key{myActiveListingsCount === 1 ? "" : "s"} listed.
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Sort</span>
            <button
              onClick={() => setSort("newest")}
              className={cn("chip border", sort === "newest" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
            >
              Newest
            </button>
            <button
              onClick={() => setSort("starting")}
              className={cn("chip border", sort === "starting" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
            >
              Starting soon
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {others.length === 0 ? (
            <div className="panel p-12 text-center">
              <div className="text-4xl mb-3">🗝️</div>
              {!anyOtherKeysExist ? (
                <>
                  <p className="text-gray-300 font-semibold">No keys listed yet.</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {canList ? "Be the first - hit “List your Key”." : "Log in with Battle.net to list your key."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-300 font-semibold">No keys match your filters.</p>
                  <button onClick={resetAll} className="text-accent text-sm mt-1 hover:underline">reset all</button>
                </>
              )}
            </div>
          ) : (
            <div>
              {mine.length > 0 && (
                <div className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-300">
                  Other Players' Keys ({others.length})
                </div>
              )}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {othersPageItems.map((g) => (
                  <GroupCard key={g.id} group={g} current={current} canApply={canList} viewerUserId={viewerUserId} highlighted={g.id === highlightId} onDelisted={removeGroup} initialMyApp={initialMyApps?.[g.id]} />
                ))}
              </div>
              {othersTotalPages > 1 && (
                <PaginationChips
                  page={othersPageClamped}
                  totalPages={othersTotalPages}
                  onPrev={() => setOthersPage((p) => Math.max(1, p - 1))}
                  onNext={() => setOthersPage((p) => Math.min(othersTotalPages, p + 1))}
                  className="mt-4"
                />
              )}
            </div>
          )}

          {mine.length > 0 && (
            <div>
              <button
                onClick={() => setMineOpen((v) => !v)}
                className="flex items-center gap-2 mb-3 text-sm font-bold uppercase tracking-wide text-gray-300"
              >
                Your Keys ({mine.length})
                <span className="text-gray-500 text-xs font-normal">{mineOpen ? "▲" : "▼"}</span>
              </button>
              {mineOpen && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {mine.map((g) => (
                    <GroupCard key={g.id} group={g} current={current} canApply={canList} viewerUserId={viewerUserId} highlighted={g.id === highlightId} onDelisted={removeGroup} initialMyApp={initialMyApps?.[g.id]} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
