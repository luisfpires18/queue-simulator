"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CLASS_BY_ID, specById, type ClassId } from "@/game/classes";
import { SpecIcon } from "../SpecIcon";
import { WowIcon } from "../WowIcon";
import { classIconSlug } from "@/game/icons";
import { DungeonOverview } from "./DungeonOverview";
import { RaidOverview } from "./RaidOverview";
import { RaidLogReport } from "./RaidLogReport";
import { BossRotations } from "./BossRotations";
import { ReportView } from "./ReportView";
import { CharacterSettings } from "./CharacterSettings";

interface SpecTrack {
  specId: string;
  role: string;
  points: number | null;
  bnetScore: number | null;
  isMain: boolean;
}
interface Character {
  id: string;
  name: string;
  realm: string;
  region: string;
  classId: string;
  level: number;
  ilvl: number | null;
  rating: number | null;
  isMain: boolean;
  bucket: string;
  wclZone: string | null;
  specTracks: SpecTrack[];
}

const LEVEL_CHOICES = [18, 19, 20, 21, 22, 23, 24, 25];

function specScore(t: SpecTrack) {
  return t.bnetScore ?? t.points ?? -1;
}

export function ImprovementTab({ characters }: { characters: Character[] }) {
  const router = useRouter();
  const usable = useMemo(
    () => characters.filter((c) => c.bucket !== "hidden").sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.ilvl ?? -1) - (a.ilvl ?? -1)),
    [characters]
  );
  const [mode, setMode] = useState<"mplus" | "raid">("mplus");
  const [activeCharId, setActiveCharId] = useState<string | null>(
    () => usable.find((c) => c.isMain)?.id ?? usable[0]?.id ?? null
  );
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const activeChar = usable.find((c) => c.id === activeCharId) ?? null;
  const dpsSpecs = [...(activeChar?.specTracks ?? [])].filter((s) => s.role === "DPS").sort((a, b) => specScore(b) - specScore(a));

  useEffect(() => {
    if (activeChar && !activeSpecId && dpsSpecs.length) setActiveSpecId(dpsSpecs[0].specId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharId, characters]);

  // ---- M+ report state ----
  const [mplusReport, setMplusReport] = useState<{ encounterID: number; level: number; compareTo: string } | null>(null);
  const [mplusView, setMplusView] = useState<any>(null);
  const [mplusError, setMplusError] = useState<string | null>(null);
  const [mplusLoading, setMplusLoading] = useState(false);
  const [mplusRefreshToken, setMplusRefreshToken] = useState(0);

  async function loadMplusReport(encounterID: number, level: number, compareTo = "") {
    if (!activeCharId || !activeSpecId) return;
    setMplusReport({ encounterID, level, compareTo });
    setMplusLoading(true);
    setMplusError(null);
    try {
      const params = new URLSearchParams({ characterId: activeCharId, specId: activeSpecId, encounter: String(encounterID), level: String(level) });
      if (compareTo) params.set("compareTo", compareTo);
      const res = await fetch(`/api/wcl/report?${params}`);
      const view = await res.json();
      if (!res.ok) throw new Error(view.error || `HTTP ${res.status}`);
      setMplusView(view);
    } catch (err) {
      setMplusError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMplusLoading(false);
    }
  }

  // ---- Raid report state ----
  const [raidReport, setRaidReport] = useState<{ encounterID: number; compareTo: string } | null>(null);
  const [raidView, setRaidView] = useState<any>(null);
  const [raidError, setRaidError] = useState<string | null>(null);
  const [raidLoading, setRaidLoading] = useState(false);
  const [raidRefreshToken, setRaidRefreshToken] = useState(0);

  async function loadRaidBoss(encounterID: number, compareTo = "") {
    if (!activeCharId || !activeSpecId) return;
    setRaidReport({ encounterID, compareTo });
    setRaidLoading(true);
    setRaidError(null);
    try {
      const params = new URLSearchParams({ characterId: activeCharId, specId: activeSpecId, encounter: String(encounterID) });
      if (compareTo) params.set("compareTo", compareTo);
      const res = await fetch(`/api/wcl/raid/boss?${params}`);
      const view = await res.json();
      if (!res.ok) throw new Error(view.error || `HTTP ${res.status}`);
      setRaidView(view);
    } catch (err) {
      setRaidError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRaidLoading(false);
    }
  }

  function switchMode(next: "mplus" | "raid") {
    setMode(next);
    setMplusReport(null);
    setMplusView(null);
    setRaidReport(null);
    setRaidView(null);
  }

  if (!usable.length) {
    return <div className="panel p-6 text-sm text-gray-400">No characters yet - sync from Battle.net on the Characters tab first.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4 flex flex-wrap items-center gap-4">
        {activeChar && (
          <>
            {activeSpecId ? (
              <SpecIcon specId={activeSpecId} size={44} />
            ) : (
              <WowIcon slug={classIconSlug(activeChar.classId)} size={44} fallbackColor={CLASS_BY_ID[activeChar.classId as ClassId]?.color} />
            )}
            <div>
              <div className="text-sm font-bold" style={{ color: CLASS_BY_ID[activeChar.classId as ClassId]?.color }}>{activeChar.name}</div>
              <div className="text-[11px] text-gray-500">
                {CLASS_BY_ID[activeChar.classId as ClassId]?.name}
                {activeSpecId && <> · {specById(activeSpecId)?.name}</>}
              </div>
            </div>
          </>
        )}

        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-500 ml-2">
          Character
          <select
            value={activeCharId ?? ""}
            onChange={(e) => {
              setActiveCharId(e.target.value);
              setActiveSpecId(null);
              switchMode(mode);
            }}
            className="bg-panel2 border border-panelborder rounded px-2 py-1 text-sm normal-case tracking-normal text-gray-200"
          >
            {usable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - {CLASS_BY_ID[c.classId as ClassId]?.name} {c.rating != null ? `(${Math.round(c.rating)})` : ""}
              </option>
            ))}
          </select>
        </label>

        {dpsSpecs.length > 0 && (
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-500">
            Spec
            <select
              value={activeSpecId ?? ""}
              onChange={(e) => {
                setActiveSpecId(e.target.value);
                switchMode(mode);
              }}
              className="bg-panel2 border border-accent/60 rounded px-2 py-1 text-sm normal-case tracking-normal text-accent"
            >
              {dpsSpecs.map((s) => (
                <option key={s.specId} value={s.specId}>
                  {specById(s.specId)?.name ?? s.specId} {specScore(s) >= 0 ? `(${Math.round(specScore(s))})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex gap-1 ml-auto">
          <button onClick={() => switchMode("mplus")} className={`chip border ${mode === "mplus" ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}>M+</button>
          <button onClick={() => switchMode("raid")} className={`chip border ${mode === "raid" ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}>Raid</button>
        </div>
        <button onClick={() => setShowSettings((v) => !v)} className="btn-ghost text-xs px-2 py-1">
          {showSettings ? "Hide settings" : "Zone / spec settings"}
        </button>
      </div>

      {activeChar && showSettings && (
        <CharacterSettings
          characterId={activeChar.id}
          classId={activeChar.classId}
          wclZone={activeChar.wclZone}
          specTracks={activeChar.specTracks}
          onSaved={() => { setShowSettings(false); router.refresh(); }}
        />
      )}

      {activeChar && !activeChar.wclZone && !showSettings && (
        <div className="panel p-4 text-sm text-gray-400">
          This character has no Warcraft Logs zone configured yet.{" "}
          <button onClick={() => setShowSettings(true)} className="text-accent underline">Set it up</button>.
        </div>
      )}

      {activeChar && activeChar.wclZone && !dpsSpecs.length && !showSettings && (
        <div className="panel p-4 text-sm text-gray-400">
          No DPS spec is tracked for this character yet - only DPS specs can be analysed.{" "}
          <button onClick={() => setShowSettings(true)} className="text-accent underline">Pick specs</button>.
        </div>
      )}

      {activeChar && activeChar.wclZone && activeSpecId && mode === "mplus" && (
        <DungeonOverview characterId={activeChar.id} specId={activeSpecId} onOpenReport={loadMplusReport} />
      )}
      {activeChar && activeChar.wclZone && activeSpecId && mode === "raid" && !raidReport && (
        <>
          <RaidOverview characterId={activeChar.id} specId={activeSpecId} onOpenBoss={(encounterID) => loadRaidBoss(encounterID)} />
          <BossRotations classId={activeChar.classId} specId={activeSpecId} />
          <details className="panel p-4">
            <summary className="cursor-pointer text-sm font-bold">Paste a report instead <small className="text-gray-500 font-normal">- for wipes, which rankings can't show</small></summary>
            <div className="pt-3">
              <RaidLogReport characterId={activeChar.id} specId={activeSpecId} />
            </div>
          </details>
        </>
      )}

      {mode === "mplus" && mplusReport && (
        <div>
          {mplusLoading && <div className="panel p-6 text-sm text-gray-500">Building report…</div>}
          {mplusError && <div className="panel p-6 text-sm text-rose-300">Report failed: {mplusError}</div>}
          {mplusView && !mplusLoading && (
            <ReportView
              view={mplusView}
              levels={[...new Set([...LEVEL_CHOICES, mplusReport.level])].sort((a, b) => a - b)}
              level={mplusReport.level}
              onLevelChange={(l) => loadMplusReport(mplusReport.encounterID, l, mplusReport.compareTo)}
              onCompareChange={(name) => loadMplusReport(mplusReport.encounterID, mplusReport.level, name)}
              onRefresh={() => {
                setMplusRefreshToken((t) => t + 1);
                loadMplusReport(mplusReport.encounterID, mplusReport.level, mplusReport.compareTo);
              }}
              characterId={activeChar!.id}
              specId={activeSpecId!}
              encounterID={mplusReport.encounterID}
              compareTo={mplusReport.compareTo}
              refreshToken={mplusRefreshToken}
            />
          )}
        </div>
      )}

      {mode === "raid" && raidReport && (
        <div>
          {raidLoading && <div className="panel p-6 text-sm text-gray-500">Building raid report…</div>}
          {raidError && <div className="panel p-6 text-sm text-rose-300">Report failed: {raidError}</div>}
          {raidView && !raidLoading && (
            <ReportView
              view={raidView}
              onCompareChange={(name) => loadRaidBoss(raidReport.encounterID, name)}
              onRefresh={() => {
                setRaidRefreshToken((t) => t + 1);
                loadRaidBoss(raidReport.encounterID, raidReport.compareTo);
              }}
              compareTo={raidReport.compareTo}
              refreshToken={raidRefreshToken}
              embeddedChart={{ mine: raidView.mine, other: raidView.other, otherLabel: raidView.otherLabel }}
            />
          )}
        </div>
      )}
    </div>
  );
}
