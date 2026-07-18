"use client";

import { useEffect, useState } from "react";
import { BoardRow } from "./BoardRow";
import { fmtK, fmtPct, pctColor } from "@/game/wclFormat";

interface Boss {
  encounterID: number;
  name: string;
  kills: number;
  bestPercent: number | null;
  medianPercent: number | null;
  bestDps: number | null;
}
interface Zone {
  zoneID: number;
  zoneName: string;
  patch: string | null;
  bestAverage: number | null;
  bosses: Boss[];
  killedCount: number;
  bossCount: number;
}

export function RaidOverview({
  characterId,
  specId,
  onOpenBoss,
}: {
  characterId: string;
  specId: string;
  onOpenBoss: (encounterID: number) => void;
}) {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ characterId, specId });
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/wcl/raid/overview?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setZones(json.zones);
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

  if (loading) return <div className="panel p-6 text-sm text-gray-500">Loading your raids…</div>;
  if (error) return <div className="panel p-6 text-sm text-rose-300">Error: {error}</div>;
  if (!zones?.length) return <div className="panel p-6 text-sm text-gray-500">No live raids found this expansion.</div>;

  return (
    <div className="flex flex-col gap-4">
      {zones.map((z) => (
        <div key={z.zoneID} className="panel p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-bold text-sm">{z.zoneName}</h3>
            {z.patch && <span className="text-[11px] text-gray-500">patch {z.patch}</span>}
            {z.bestAverage != null && (
              <span className="ml-auto text-xs">
                <b style={{ color: pctColor(z.bestAverage) }}>{fmtPct(z.bestAverage)}</b>{" "}
                <small className="text-gray-500">best avg</small>
              </span>
            )}
            <button onClick={() => load(true)} className="btn-ghost text-xs px-2 py-1" title="Re-fetch, bypassing cache">
              ↻
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {z.bosses.map((b, i) => (
              <BoardRow
                key={b.encounterID}
                rank={i + 1}
                color={pctColor(b.bestPercent)}
                title={b.name}
                subtitle={b.kills > 0 ? `${b.kills} kill${b.kills === 1 ? "" : "s"}` : "no logged kill"}
                pct={b.bestPercent}
                value={<span style={{ color: pctColor(b.bestPercent) }}>{fmtPct(b.bestPercent)}</span>}
                meta={b.bestDps ? `dps ${fmtK(b.bestDps)}` : ""}
                dim={b.kills === 0}
                onClick={b.kills > 0 ? () => onOpenBoss(b.encounterID) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
