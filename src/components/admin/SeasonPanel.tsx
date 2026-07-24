"use client";

import { useState } from "react";
import type { SeasonDef } from "@/game/season";

export function SeasonPanel({ seasons, initialCurrentSeasonId }: { seasons: SeasonDef[]; initialCurrentSeasonId: string }) {
  const [currentSeasonId, setCurrentSeasonIdState] = useState(initialCurrentSeasonId);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(seasonId: string) {
    if (seasonId === currentSeasonId) return;
    setSavingId(seasonId);
    setError(null);
    const previous = currentSeasonId;
    setCurrentSeasonIdState(seasonId); // optimistic
    try {
      const res = await fetch("/api/admin/season", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seasonId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCurrentSeasonIdState(previous);
      setError("Failed to update - try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Whichever season is current gets snapshotted daily (see /profile's Season History tab). Switching this
        freezes the previous season's snapshot in place and starts a fresh one for the new season.
      </p>
      {error && (
        <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{error}</p>
      )}
      <div className="space-y-2">
        {seasons.map((s) => {
          const active = s.id === currentSeasonId;
          return (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              disabled={savingId != null}
              className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                active ? "border-accent bg-accent/10" : "border-panelborder bg-panel2/40 hover:border-accent/50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${active ? "bg-accent" : "bg-gray-600"}`} />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-200">
                  {s.expansion} · Season {s.season}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">Patch {s.patch}</span>
              </span>
              {active && <span className="ml-auto chip bg-accent/20 text-accent shrink-0">Current</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
