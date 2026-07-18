"use client";

import { useEffect, useState } from "react";
import { fmtK, fmtTime, castKindColor } from "@/game/wclFormat";

interface Boss {
  encounterID: number;
  name: string;
  zoneName: string;
}
interface RosterEntry {
  rank: number;
  name: string;
  dps: number;
  durationSec: number | null;
}
interface Rotations {
  boss: string | null;
  players: RosterEntry[];
  selected: RosterEntry & { cpm: number; castOrder: { tSec: number; kind: string; name: string }[] };
}

// "How is this boss played by this spec" — no log, no kill needed. Just the
// #1 (or any picked) ranked player's rotation, read before you ever pull it.
export function BossRotations({ classId, specId }: { classId: string; specId: string }) {
  const [bosses, setBosses] = useState<Boss[] | null>(null);
  const [encounterID, setEncounterID] = useState<number | null>(null);
  const [data, setData] = useState<Rotations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRoster(id: number, player?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ classId, specId, encounter: String(id) });
      if (player) params.set("player", player);
      const res = await fetch(`/api/wcl/raid/rotations?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setEncounterID(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <h3 className="text-sm font-bold">Learn a boss <small className="text-gray-500 font-normal">- a top parser's rotation, no log needed</small></h3>
      <BossPicker bosses={bosses} setBosses={setBosses} onPick={(id) => loadRoster(id)} />
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {loading && <p className="text-xs text-gray-500">Loading…</p>}
      {data && encounterID != null && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {data.players.map((p) => (
              <button
                key={p.name}
                onClick={() => loadRoster(encounterID, p.name)}
                className={`chip border ${p.name === data.selected.name ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}
              >
                #{p.rank} {p.name} - {fmtK(p.dps)}
              </button>
            ))}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">
              {data.selected.name}'s rotation on {data.boss} · {fmtK(data.selected.dps)} avg · {data.selected.cpm} CPM
            </div>
            <ol className="space-y-0.5 max-h-96 overflow-y-auto">
              {data.selected.castOrder.map((c, i) => (
                <li key={i} className="text-xs">
                  <span className="text-gray-500 mr-1.5 tabular-nums">{fmtTime(c.tSec * 1000)}</span>
                  <span style={{ color: castKindColor(c.kind) }}>{c.name}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

function BossPicker({
  bosses,
  setBosses,
  onPick,
}: {
  bosses: Boss[] | null;
  setBosses: (b: Boss[]) => void;
  onPick: (encounterID: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function ensureLoaded() {
    if (bosses) return;
    try {
      const res = await fetch("/api/wcl/raid/bosses");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setBosses(json.bosses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  useEffect(() => {
    ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="text-xs text-rose-300">{error}</p>;
  if (!bosses) return <p className="text-xs text-gray-500">Loading raid bosses…</p>;

  const byZone = new Map<string, Boss[]>();
  for (const b of bosses) {
    if (!byZone.has(b.zoneName)) byZone.set(b.zoneName, []);
    byZone.get(b.zoneName)!.push(b);
  }

  return (
    <select
      onChange={(e) => e.target.value && onPick(Number(e.target.value))}
      defaultValue=""
      className="bg-panel2 border border-panelborder rounded px-2 py-1.5 text-sm"
    >
      <option value="" disabled>Pick a boss…</option>
      {[...byZone.entries()].map(([zoneName, list]) => (
        <optgroup key={zoneName} label={zoneName}>
          {list.map((b) => (
            <option key={b.encounterID} value={b.encounterID}>{b.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
