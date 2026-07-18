"use client";

import { useEffect, useState } from "react";
import { BoardRow } from "./BoardRow";
import { fmtK, fmtPct, fmtTime, pctColor } from "@/game/wclFormat";

interface Dungeon {
  encounterID: number;
  name: string;
  bestPercent: number | null;
  medianPercent: number | null;
  keyLevel: number | null;
  durationMs: number | null;
  bestDps: number | null;
}
interface Overview {
  character: string;
  overall: { bestPerformanceAverage: number | null; medianPerformanceAverage: number | null };
  dungeons: Dungeon[];
}

const DEFAULT_LEVEL = 20;

export function DungeonOverview({
  characterId,
  specId,
  onOpenReport,
}: {
  characterId: string;
  specId: string;
  onOpenReport: (encounterID: number, level: number) => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"weakest" | "best">("weakest");

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ characterId, specId });
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/wcl/overview?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, specId]);

  if (loading) return <div className="panel p-6 text-sm text-gray-500">Loading your dungeons…</div>;
  if (error) return <div className="panel p-6 text-sm text-rose-300">Error: {error}</div>;
  if (!data) return null;

  const ranked = [...data.dungeons].sort((a, b) => {
    const av = a.bestPercent;
    const bv = b.bestPercent;
    if (typeof av !== "number") return 1;
    if (typeof bv !== "number") return -1;
    return sort === "weakest" ? av - bv : bv - av;
  });

  const defaultLevelFor = (encounterID: number) => {
    const d = data.dungeons.find((x) => x.encounterID === encounterID);
    return typeof d?.keyLevel === "number" ? d.keyLevel : DEFAULT_LEVEL;
  };

  const worst = [...data.dungeons]
    .filter((d) => typeof d.bestPercent === "number")
    .sort((a, b) => (a.bestPercent as number) - (b.bestPercent as number))[0];

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="flex items-baseline gap-1.5">
          <b className="text-lg" style={{ color: pctColor(data.overall.bestPerformanceAverage) }}>
            {fmtPct(data.overall.bestPerformanceAverage)}
          </b>
          <small className="text-gray-500">best avg · Mythic+</small>
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setSort("weakest")}
            className={`chip border ${sort === "weakest" ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}
          >
            Weakest first
          </button>
          <button
            onClick={() => setSort("best")}
            className={`chip border ${sort === "best" ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}
          >
            Best first
          </button>
        </div>
        {worst && (
          <button onClick={() => onOpenReport(worst.encounterID, defaultLevelFor(worst.encounterID))} className="btn-gold ml-auto text-xs px-2.5 py-1">
            Analyze my worst parse
          </button>
        )}
        <button onClick={() => load(true)} className="btn-ghost text-xs px-2.5 py-1" title="Re-fetch from Warcraft Logs, bypassing the local cache">
          ↻ Refresh
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {ranked.map((d, i) => (
          <BoardRow
            key={d.encounterID}
            rank={i + 1}
            color={pctColor(d.bestPercent)}
            title={d.name}
            subtitle={typeof d.bestPercent === "number" ? `+${d.keyLevel ?? "?"} · ${fmtTime(d.durationMs)}` : "no logged run"}
            pct={d.bestPercent}
            value={<span style={{ color: pctColor(d.bestPercent) }}>{fmtPct(d.bestPercent)}</span>}
            meta={typeof d.bestPercent === "number" ? `dps ${fmtK(d.bestDps)}` : ""}
            dim={typeof d.bestPercent !== "number"}
            onClick={() => onOpenReport(d.encounterID, defaultLevelFor(d.encounterID))}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        The bar <b>is</b> the percentile, so it reads the same in every dungeon. Click a row to analyse your best run there against the top runs of your spec at that key level.
      </p>
    </div>
  );
}
