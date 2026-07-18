"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurrentSelectionDTO, GroupDTO } from "@/data/source";
import { GroupCard } from "./GroupCard";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { ALL_SPECS, type ClassId, type Role } from "@/game/classes";
import { DUNGEONS } from "@/game/season";
import { cn } from "@/lib/utils";

const MIN_KEY = 2;
const MAX_KEY = 25;
const OTHERS_PAGE_SIZE = 10;
const ROLES: Role[] = ["TANK", "HEALER", "DPS"];
const ROLE_MAX: Record<Role, number> = { TANK: 1, HEALER: 1, DPS: 3 };
const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

// Classes that bring Bloodlust/Heroism-equivalent; none of these are tanks.
const BL_CLASSES: ClassId[] = ["hunter", "shaman", "mage", "evoker"];
const BL_ROLES = new Set<Role>(["DPS", "HEALER"]);

function bloodlustFits(group: GroupDTO): boolean {
  const hasBL = group.members.some((m) => BL_CLASSES.includes(m.classId as ClassId));
  const hasOpenBLSlot = group.slots.some((s) => BL_ROLES.has(s.role as Role));
  return hasBL || hasOpenBLSlot;
}

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

export function BoardClient({
  initial, canList, current, viewerUserId,
}: {
  initial: GroupDTO[];
  canList: boolean;
  current: CurrentSelectionDTO | null;
  viewerUserId: string | null;
}) {
  const [groups, setGroups] = useState<GroupDTO[]>(initial);
  const [live, setLive] = useState(false);
  const [lo, setLo] = useState(MIN_KEY);
  const [hi, setHi] = useState(MAX_KEY);
  const [dungeons, setDungeons] = useState<Set<string>>(new Set());
  const [roleMax, setRoleMax] = useState<Record<Role, number>>({ ...ROLE_MAX });
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
  // client-side slice, not a server round-trip).
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
  }, [lo, hi, dungeons, roleMax, excludeSpecs, bloodlustFit, others.length]);
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
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className={cn("h-2 w-2 rounded-full", live ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
          <span className="text-sm text-gray-400">
            {filtered.length} key{filtered.length === 1 ? "" : "s"} listed
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="panel p-12 text-center">
            <div className="text-4xl mb-3">🗝️</div>
            {groups.length === 0 ? (
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
          <div className="space-y-6">
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
                    Other Players' Keys ({others.length})
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
