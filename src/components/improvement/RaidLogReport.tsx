"use client";

import { useState } from "react";
import { fmtK } from "@/game/wclFormat";
import { ReportView } from "./ReportView";

interface Boss {
  encounterID: number;
  name: string;
  difficulty: number;
  difficultyName: string;
  pulls: number;
  kills: number;
  bestPctRemaining: number | null;
}
interface ReportMenu {
  code: string;
  title: string;
  zone: string;
  bosses: Boss[];
}
interface ProgressionRow {
  fightID: number;
  kill: boolean;
  pctRemaining: number | null;
  durationSec: number | null;
  analysed: boolean;
  activeDps: number;
  deaths: number;
}

// Progression from a pasted report code — the one thing rankings can't show: a
// WIPE. Drill-down: paste code -> pick boss -> pick pull -> full 8-section report.
export function RaidLogReport({ characterId, specId }: { characterId: string; specId: string }) {
  const [code, setCode] = useState("");
  const [menu, setMenu] = useState<ReportMenu | null>(null);
  const [boss, setBoss] = useState<{ encounterID: number; rows: ProgressionRow[] } | null>(null);
  const [pull, setPull] = useState<{ encounterID: number; fightID: number; compareTo: string } | null>(null);
  const [view, setView] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  async function loadMenu() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setMenu(null);
    setBoss(null);
    setPull(null);
    setView(null);
    try {
      const params = new URLSearchParams({ characterId, specId, code: code.trim() });
      const res = await fetch(`/api/wcl/raid/report?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMenu(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadBoss(encounterID: number) {
    setLoading(true);
    setError(null);
    setBoss(null);
    setPull(null);
    setView(null);
    try {
      const params = new URLSearchParams({ characterId, specId, code: code.trim(), encounter: String(encounterID) });
      const res = await fetch(`/api/wcl/raid/report?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBoss({ encounterID, rows: data.progression?.rows ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPull(encounterID: number, fightID: number, compareTo = "") {
    setPull({ encounterID, fightID, compareTo });
    setLoading(true);
    setError(null);
    setView(null);
    try {
      const params = new URLSearchParams({ characterId, specId, code: code.trim(), encounter: String(encounterID), fight: String(fightID) });
      if (compareTo) params.set("compareTo", compareTo);
      const res = await fetch(`/api/wcl/raid/pull?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4 flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Report code or warcraftlogs.com URL"
          className="bg-panel2 border border-panelborder rounded px-2 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button onClick={loadMenu} disabled={loading} className="btn-gold text-sm px-3 py-1.5">Load report</button>
      </div>

      {error && <div className="panel p-4 text-sm text-rose-300">{error}</div>}

      {menu && !boss && (
        <div className="panel p-4">
          <h3 className="text-sm font-bold mb-2">{menu.title} <small className="text-gray-500">{menu.zone}</small></h3>
          <div className="flex flex-col gap-1">
            {menu.bosses.map((b) => (
              <button
                key={`${b.encounterID}-${b.difficulty}`}
                onClick={() => loadBoss(b.encounterID)}
                className="flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-panel2"
              >
                <span>{b.name} <small className="text-gray-500">{b.difficultyName}</small></span>
                <span className="text-xs text-gray-400">{b.kills} kills / {b.pulls} pulls</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {boss && !view && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setBoss(null)} className="btn-ghost text-xs px-2 py-1">← bosses</button>
            <h3 className="text-sm font-bold">Pulls</h3>
          </div>
          <div className="flex flex-col gap-1">
            {boss.rows.map((r) => (
              <button
                key={r.fightID}
                onClick={() => loadPull(boss.encounterID, r.fightID)}
                disabled={!r.analysed}
                className="flex items-center justify-between text-left text-sm px-2 py-1.5 rounded hover:bg-panel2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>
                  Pull #{r.fightID} {r.kill ? <span className="text-emerald-400">kill</span> : <span className="text-gray-400">wipe @ {r.pctRemaining}%</span>}
                </span>
                <span className="text-xs text-gray-400">
                  {r.analysed ? `${fmtK(r.activeDps)} dps · ${r.deaths} deaths` : "not analysed"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pull && (
        <div>
          {loading && <div className="panel p-6 text-sm text-gray-500">Building report…</div>}
          {view && !loading && (
            <ReportView
              view={view}
              onCompareChange={(name) => loadPull(pull.encounterID, pull.fightID, name)}
              onRefresh={() => {
                setRefreshToken((t) => t + 1);
                loadPull(pull.encounterID, pull.fightID, pull.compareTo);
              }}
              compareTo={pull.compareTo}
              refreshToken={refreshToken}
              embeddedChart={{ mine: view.mine, other: view.other, otherLabel: view.otherLabel }}
            />
          )}
        </div>
      )}
    </div>
  );
}
