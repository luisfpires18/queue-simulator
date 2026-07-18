"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/source";
import { GroupCard } from "./GroupCard";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { ALL_SPECS, type ClassId, type Role } from "@/game/classes";
import { RAIDS, RAID_DIFFICULTIES, RAID_DIFFICULTY_LABEL, type RaidDifficulty } from "@/game/raidSeason";
import { cn } from "@/lib/utils";

const OTHERS_PAGE_SIZE = 10;
const ROLES: Role[] = ["TANK", "HEALER", "DPS"];
const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

// Classes that bring Bloodlust/Heroism-equivalent; none of these are tanks.
const BL_CLASSES: ClassId[] = ["hunter", "shaman", "mage", "evoker"];
const BL_ROLES = new Set<Role>(["DPS", "HEALER"]);

function bloodlustFits(group: GroupDTO): boolean {
  const hasBL = group.members.some((m) => BL_CLASSES.includes(m.classId as ClassId));
  const hasOpenBLSlot = group.slots.some((s) => BL_ROLES.has(s.role as Role));
  return hasBL || hasOpenBLSlot;
}

function SpecPicker({
  selected, onToggle,
}: { selected: Set<string>; onToggle: (specId: string) => void }) {
  return (
    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
      {ROLES.map((role) => (
        <div key={role}>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{ROLE_LABEL[role]}</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SPECS.filter((sp) => sp.role === role).map((sp) => {
              const on = selected.has(sp.id);
              return (
                <button
                  key={sp.id}
                  onClick={() => onToggle(sp.id)}
                  title={sp.name}
                  className={cn(
                    "rounded-md p-0.5 border transition",
                    on ? "border-accent bg-accent/10" : "border-transparent opacity-40 hover:opacity-80"
                  )}
                >
                  <SpecIcon specId={sp.id} size={26} showRole={false} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RaidBoardClient({
  initial, canList, current, viewerUserId,
}: {
  initial: GroupDTO[];
  canList: boolean;
  current: CurrentSelectionDTO | null;
  viewerUserId: string | null;
}) {
  const [groups, setGroups] = useState<GroupDTO[]>(initial);
  const [live, setLive] = useState(false);
  const [raids, setRaids] = useState<Set<string>>(new Set());
  const [difficulties, setDifficulties] = useState<Set<RaidDifficulty>>(new Set());
  // minimum still-OPEN slots per role - a write box, no upper bound, same as
  // the comp picker on the listing form.
  const [minOpen, setMinOpen] = useState<Record<Role, number>>({ TANK: 0, HEALER: 0, DPS: 0 });
  const [excludeSpecs, setExcludeSpecs] = useState<Set<string>>(new Set());
  const [bloodlustFit, setBloodlustFit] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/stream/board");
    es.addEventListener("board", (e) => {
      try {
        setGroups(JSON.parse((e as MessageEvent).data).groups);
        setLive(true);
      } catch {}
    });
    es.onerror = () => setLive(false);
    return () => es.close();
  }, []);

  const toggleRaid = (id: string) =>
    setRaids((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleDifficulty = (d: RaidDifficulty) =>
    setDifficulties((s) => {
      const next = new Set(s);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  const toggleExcludeSpec = (id: string) =>
    setExcludeSpecs((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const resetAll = () => {
    setRaids(new Set());
    setDifficulties(new Set());
    setMinOpen({ TANK: 0, HEALER: 0, DPS: 0 });
    setExcludeSpecs(new Set());
    setBloodlustFit(false);
  };

  const filtered = useMemo(
    () =>
      groups.filter((g) => {
        if (g.kind !== "raid" || g.raidId == null || g.raidSize == null) return false;
        if (raids.size > 0 && !raids.has(g.raidId)) return false;
        if (difficulties.size > 0 && !difficulties.has(g.raidDifficulty as RaidDifficulty)) return false;

        for (const role of ROLES) {
          if (minOpen[role] <= 0) continue;
          const openCount = g.slots.filter((s) => s.role === role).length;
          if (openCount < minOpen[role]) return false;
        }

        if (excludeSpecs.size > 0) {
          const hasExcluded = g.members.some((m) => excludeSpecs.has(m.broughtSpecId ?? m.specId ?? ""));
          if (hasExcluded) return false;
        }

        if (bloodlustFit && !bloodlustFits(g)) return false;

        return true;
      }),
    [groups, raids, difficulties, minOpen, excludeSpecs, bloodlustFit]
  );

  const mine = useMemo(
    () => (viewerUserId ? filtered.filter((g) => g.ownerUserId === viewerUserId) : []),
    [filtered, viewerUserId]
  );
  const others = useMemo(
    () => filtered.filter((g) => g.ownerUserId !== viewerUserId),
    [filtered, viewerUserId]
  );
  const [mineOpen, setMineOpen] = useState(true);
  const [othersPage, setOthersPage] = useState(1);
  useEffect(() => {
    setOthersPage(1);
  }, [raids, difficulties, minOpen, excludeSpecs, bloodlustFit, others.length]);
  const othersTotalPages = Math.max(1, Math.ceil(others.length / OTHERS_PAGE_SIZE));
  const othersPageClamped = Math.min(othersPage, othersTotalPages);
  const othersPageItems = others.slice(
    (othersPageClamped - 1) * OTHERS_PAGE_SIZE,
    othersPageClamped * OTHERS_PAGE_SIZE
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* filters */}
      <aside className="panel p-4 h-max lg:sticky lg:top-20 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold uppercase tracking-wide text-sm">Filters</h2>
          <button onClick={resetAll} className="text-xs text-gray-400 hover:text-white">reset all</button>
        </div>

        {/* raid */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Raid
          </label>
          <div className="flex flex-wrap gap-1.5">
            {RAIDS.map((r) => {
              const on = raids.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRaid(r.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-[11px]",
                    on ? "border-accent bg-accent/10 text-accent" : "border-panelborder text-gray-400"
                  )}
                >
                  {r.icon && <WowIcon slug={r.icon} size={24} cdnSize="small" rounded="sm" />}
                  {r.abbr}
                </button>
              );
            })}
          </div>
        </div>

        {/* difficulty */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Difficulty
          </label>
          <div className="flex flex-wrap gap-1.5">
            {RAID_DIFFICULTIES.map((d) => {
              const on = difficulties.has(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDifficulty(d)}
                  className={cn("chip border", on ? "border-accent bg-accent/10 text-accent" : "border-panelborder text-gray-400")}
                >
                  {RAID_DIFFICULTY_LABEL[d]}
                </button>
              );
            })}
          </div>
        </div>

        {/* open slots needed, per role - write boxes, no upper bound */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Open slots needed
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((role) => (
              <div key={role}>
                <span className="text-[10px] text-gray-500">{ROLE_LABEL[role]}</span>
                <input
                  type="number"
                  min={0}
                  value={minOpen[role]}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setMinOpen((prev) => ({ ...prev, [role]: v }));
                  }}
                  className="w-full bg-panel2 border border-panelborder rounded-md px-2 py-1 text-sm text-center tabular-nums"
                />
              </div>
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
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className={cn("h-2 w-2 rounded-full", live ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
          <span className="text-sm text-gray-400">
            {filtered.length} raid{filtered.length === 1 ? "" : "s"} listed
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="panel p-12 text-center">
            <div className="text-4xl mb-3">🐉</div>
            {groups.filter((g) => g.kind === "raid").length === 0 ? (
              <>
                <p className="text-gray-300 font-semibold">No raids listed yet.</p>
                <p className="text-gray-500 text-sm mt-1">
                  {canList ? "Be the first - hit “List your Raid”." : "Log in with Battle.net to list your raid."}
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-300 font-semibold">No raids match your filters.</p>
                <button onClick={resetAll} className="text-accent text-sm mt-1 hover:underline">reset all</button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {mine.length > 0 && (
              <div>
                <button
                  onClick={() => setMineOpen((v) => !v)}
                  className="flex items-center gap-2 mb-3 text-sm font-bold uppercase tracking-wide text-gray-300"
                >
                  Your Raids ({mine.length})
                  <span className="text-gray-500 text-xs font-normal">{mineOpen ? "▲" : "▼"}</span>
                </button>
                {mineOpen && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {mine.map((g) => (
                      <GroupCard key={g.id} group={g} current={current} canApply={canList} viewerUserId={viewerUserId} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {others.length > 0 && (
              <div>
                {mine.length > 0 && (
                  <div className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-300">
                    Other Players' Raids ({others.length})
                  </div>
                )}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {othersPageItems.map((g) => (
                    <GroupCard key={g.id} group={g} current={current} canApply={canList} viewerUserId={viewerUserId} />
                  ))}
                </div>
                {othersTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => setOthersPage((p) => Math.max(1, p - 1))}
                      disabled={othersPageClamped <= 1}
                      className={cn("chip border border-panelborder text-gray-400", othersPageClamped <= 1 ? "opacity-40" : "hover:bg-panel2")}
                    >
                      ← Prev
                    </button>
                    <span className="text-[11px] text-gray-500">Page {othersPageClamped} / {othersTotalPages}</span>
                    <button
                      onClick={() => setOthersPage((p) => Math.min(othersTotalPages, p + 1))}
                      disabled={othersPageClamped >= othersTotalPages}
                      className={cn("chip border border-panelborder text-gray-400", othersPageClamped >= othersTotalPages ? "opacity-40" : "hover:bg-panel2")}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
