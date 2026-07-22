"use client";

import { useState } from "react";
import type { RaidKillDTO } from "@/data/dto";
import { RAIDS, RAID_KILL_DIFFICULTY_LABEL, raidMythicProgress, type RaidKillDifficulty } from "@/game/raidSeason";
import { WowIcon } from "./WowIcon";
import { cn } from "@/lib/utils";

// Parallel to DungeonGrid.tsx, not a modification of it - a raid boss has no
// "timed"/"+level" concept, just kill/no-kill + highest difficulty cleared.
// No parse/percentile (explicitly out of scope) - this is a plain boolean
// grid, grouped by raid.

function tileBorderClass(difficulty: RaidKillDifficulty | null): string {
  if (difficulty === "mythic") return "border-purple-500";
  if (difficulty === "heroic") return "border-blue-500";
  if (difficulty === "normal") return "border-green-500";
  if (difficulty === "lfr") return "border-gray-300";
  return "border-panelborder";
}

function labelColor(difficulty: RaidKillDifficulty | null): string {
  if (difficulty === "mythic") return "text-purple-400";
  if (difficulty === "heroic") return "text-blue-400";
  if (difficulty === "normal") return "text-green-400";
  if (difficulty === "lfr") return "text-gray-300";
  return "text-gray-600";
}

export function RaidBossGrid({
  raidKills, defaultOpen = true, highlightRaidId, syncable = false,
}: {
  raidKills: RaidKillDTO[];
  defaultOpen?: boolean;
  highlightRaidId?: string;
  /** Only true on your own private roster board, where a "↻ Refresh" button
   * actually exists - public/shared views (/u/..., /player/...) have no such
   * control, so their empty state shouldn't tell you to click one. */
  syncable?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const killByBoss = new Map(raidKills.map((k) => [`${k.raidId}:${k.bossId}`, k.difficulty]));
  const anyKills = raidKills.length > 0;
  const progress = raidMythicProgress(raidKills);

  return (
    <div className="w-full pt-2 border-t border-panelborder/60">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Raid bosses
        </span>
        {progress.total > 0 && (
          <span className="text-[10px] text-gray-500 tabular-nums">
            {progress.abbrLabel} <span className="text-purple-400 font-bold">{progress.killed}/{progress.total} M</span>
          </span>
        )}
        <span className="ml-auto text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="pt-2 space-y-3">
          {!anyKills ? (
            <p className="text-xs text-gray-600">
              No logged kills yet{syncable ? " - hit ↻ Refresh above." : "."}
            </p>
          ) : (
            RAIDS.map((raid) => (
              <div key={raid.id}>
                <div className={cn("text-[9px] uppercase tracking-wide mb-1", raid.id === highlightRaidId ? "text-accent font-semibold" : "text-gray-500")}>
                  {raid.name}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {raid.bosses.map((b) => {
                    const difficulty = killByBoss.get(`${raid.id}:${b.id}`) ?? null;
                    return (
                      <div
                        key={b.id}
                        className="flex flex-col items-center gap-1"
                        title={difficulty ? `${b.name}: killed on ${RAID_KILL_DIFFICULTY_LABEL[difficulty]}` : b.name}
                      >
                        <div className={cn("w-11 h-11 rounded-md overflow-hidden border", tileBorderClass(difficulty))}>
                          {b.icon ? (
                            <WowIcon
                              slug={b.icon}
                              size={44}
                              cdnSize="medium"
                              rounded="sm"
                              className={!difficulty ? "grayscale opacity-30" : undefined}
                            />
                          ) : (
                            <div className="w-full h-full bg-panel2 grid place-items-center text-[8px] text-gray-500 text-center px-0.5">
                              {b.name}
                            </div>
                          )}
                        </div>
                        <span className={cn("text-xs font-bold uppercase tabular-nums", labelColor(difficulty))}>
                          {difficulty ? RAID_KILL_DIFFICULTY_LABEL[difficulty][0] : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
