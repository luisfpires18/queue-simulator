"use client";

import { useState } from "react";
import type { CardSpecTrack } from "./CharacterCard";
import { classById } from "@/game/classes";
import { DUNGEONS } from "@/game/season";
import { normalizeDungeonName } from "@/game/achievements";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { cn } from "@/lib/utils";

function tileRingClass(timed: boolean | null): string {
  if (timed === true) return "ring-emerald-500/60";
  if (timed === false) return "ring-rose-500/60";
  return "ring-panelborder";
}

function scoreColor(timed: boolean | null): string {
  if (timed === true) return "text-emerald-300";
  if (timed === false) return "text-rose-300";
  return "text-gray-600";
}

/** This season's per-dungeon best runs, switchable by spec — every dungeon
 * shown (icon-forward, raider.io-tile style), ordered by level then score
 * (best first) rather than a fixed dungeon order, with the dungeon a key's
 * being listed/applied for called out via `highlightDungeonId`. */
export function DungeonGrid({
  classId, specTracks, defaultOpen = false, initialSpecId, highlightDungeonId,
}: {
  classId: string;
  specTracks: CardSpecTrack[];
  defaultOpen?: boolean;
  initialSpecId?: string;
  highlightDungeonId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // highest score first (main spec pinned first among ties/no-score specs)
  const orderedTracks = [...specTracks].sort((a, b) => {
    const mainDiff = (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0);
    if (mainDiff !== 0) return mainDiff;
    return (b.bnetScore ?? b.points ?? -1) - (a.bnetScore ?? a.points ?? -1);
  });
  const played = orderedTracks.length > 0
    ? orderedTracks.map((t) => t.specId)
    : (classById(classId)?.specs ?? []).map((s) => s.id);

  const trackBySpec = new Map(specTracks.map((t) => [t.specId, t]));
  const [selected, setSelected] = useState<string>(
    (initialSpecId && trackBySpec.has(initialSpecId) ? initialSpecId : undefined)
      ?? specTracks.find((t) => t.isMain)?.specId
      ?? played[0]
      ?? ""
  );

  const runs = trackBySpec.get(selected)?.bestRuns ?? [];
  const runByDungeonName = new Map(runs.map((r) => [normalizeDungeonName(r.dungeonName), r]));
  const runFor = (d: (typeof DUNGEONS)[number]) => runByDungeonName.get(normalizeDungeonName(d.name)) ?? null;
  const sortedDungeons = [...DUNGEONS].sort((a, b) => {
    const ra = runFor(a);
    const rb = runFor(b);
    const levelDiff = (rb?.level ?? -1) - (ra?.level ?? -1);
    if (levelDiff !== 0) return levelDiff;
    return (rb?.score ?? -1) - (ra?.score ?? -1);
  });

  return (
    <div className="w-full pt-2 border-t border-panelborder/60">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Keys this season
        </span>
        <span className="ml-auto text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="pt-2 space-y-2">
          {played.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {played.map((specId) => (
                <button
                  key={specId}
                  onClick={() => setSelected(specId)}
                  className={cn(
                    "rounded-md p-0.5 border",
                    selected === specId ? "border-accent bg-panel2" : "border-transparent opacity-50 hover:opacity-90"
                  )}
                >
                  <SpecIcon specId={specId} size={24} showRole={false} />
                </button>
              ))}
            </div>
          )}

          {runs.length === 0 ? (
            <p className="text-xs text-gray-600">No logged runs yet — hit Refresh rating.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {sortedDungeons.map((d) => {
                const r = runFor(d);
                const current = d.id === highlightDungeonId;
                return (
                  <div key={d.id} className="flex flex-col items-center gap-1" title={r ? `${d.name}: Score ${Math.round(r.score)}${r.timed === false ? " (depleted)" : ""}` : d.name}>
                    <div
                      className={cn(
                        "w-11 h-11 rounded-md overflow-hidden ring-1 ring-inset",
                        tileRingClass(r?.timed ?? null),
                        current && "ring-2 ring-accent"
                      )}
                    >
                      <WowIcon
                        slug={d.icon}
                        size={44}
                        cdnSize="medium"
                        rounded="sm"
                        className={!r ? "grayscale opacity-30" : undefined}
                      />
                    </div>
                    <span className={cn("text-[9px] uppercase tracking-wide", current ? "text-accent font-semibold" : "text-gray-500")}>{d.abbr}</span>
                    <span className={cn("text-xs font-bold tabular-nums", scoreColor(r?.timed ?? null))}>
                      {r ? `+${r.level}` : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
