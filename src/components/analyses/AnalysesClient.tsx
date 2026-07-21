"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { classColor, specById, type ClassId } from "@/game/classes";
import { ratingTier } from "@/game/season";
import { BoardRow } from "@/components/improvement/BoardRow";

// ---- response types (mirror /api/analyses) ----
interface Defensive { spellId: number; name: string; uses: number; mitigatedAmount: number; mitigated: boolean }
interface External { spellId: number; name: string; casts: number }
interface TakenAbility { name: string; guid: number | null; total: number; hits: number }
interface InterruptAbility { name: string; guid: number | null; count: number }
interface RunOverall {
  damage: number; dps: number; healing: number; hps: number; damageTaken: number;
  damageTakenAbilities: TakenAbility[];
  interrupts: number; interruptsLanded: number; interruptsAttempts: number; interruptAbilities: InterruptAbility[];
  avoidableCounted: boolean; avoidableDamage: number; avoidableHits: number;
  avoidableAbilities: { spellId: number; name: string; category: string; severity: string; amount: number; hits: number }[];
  dispels: number | null; purges: number | null;
  deaths: { timestamp: number | null; topAbility: string | null }[];
  defensives: Defensive[]; externals: External[];
}
interface Boss { encounterID: number; name: string | null; kill: boolean | null; durationMs: number; bossOnly?: boolean; damage: number; dps: number; healing: number; hps: number }
interface Run { code: string; fightID: number; keyLevel: number | null; durationMs: number; overall: RunOverall; bosses: Boss[]; rankPercent: number | null }
interface FieldCompare { parsePercent: number | null; applicantDps: number; topName: string | null; topDps: number | null; fieldMedianDps: number | null; fieldBestDps: number | null; fieldSize: number | null }
interface ScorePart { key: string; label: string; weight: number; value: number; points: number }
interface DungeonResult { dungeon: { encounterID: number; name: string }; maxLevel: number | null; levels: (number | null)[]; runs: Run[]; fieldCompare: FieldCompare | null; score: number | null; scoreBreakdown: ScorePart[] }
interface Overall {
  damage: number; healing: number; damageTaken: number; durationMs: number;
  interrupts: number; dispels: number | null; purges: number | null; deaths: number;
  defensiveUses: number; defensiveMitigated: number; externalUses: number;
  dungeonsWithData: number; dps: number; hps: number; score: number | null;
}
interface Fit { verdict: "fit" | "borderline" | "no"; score: number; reasons: string[]; referenceLevel: number | null; overallMax: number | null }
interface Meta { region: string; realm: string; name: string; classId: string; specId: string | null; rating: number | null; ilvl: number | null; interrupt: { spellId: number; name: string } | null; avoidableVersion: string; zone: { id: number; name: string } }
interface Result { character: { name: string }; dungeons: DungeonResult[]; overall: Overall; fit: Fit; meta: Meta }

const REGIONS = ["us", "eu", "kr", "tw", "cn"];

// Realm autocomplete — same source + module-cache pattern as PlayerSearchBar, so
// the applicant realm is a real slug ("aggra-portugues"), never raw typed text
// ("Aggra (Português)") that WCL/raider.io can't resolve.
interface RealmOption { id: number; name: string; slug: string }
const realmCache = new Map<string, Promise<RealmOption[]>>();
function loadRealms(region: string): Promise<RealmOption[]> {
  let pending = realmCache.get(region);
  if (!pending) {
    pending = fetch(`/api/realms?region=${region}`)
      .then((r) => r.json())
      .then((data) => data.realms ?? [])
      .catch(() => []);
    realmCache.set(region, pending);
  }
  return pending;
}

// ---- number formatting ----
function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
function levelDist(levels: (number | null)[]): string {
  return levels.filter((l) => l != null).join(" ") || "-";
}

// WCL parse-color palette (same breakpoints as the WCL site / parseTiers.js):
// gray < 25, green < 50, blue < 75, purple < 95, orange < 99, pink >= 99.
function parseTierColor(pct: number | null | undefined): string {
  if (pct == null) return "#6b7280"; // gray — no parse
  if (pct >= 99) return "#e268a8";
  if (pct >= 95) return "#ff8000";
  if (pct >= 75) return "#a335ee";
  if (pct >= 50) return "#0070ff";
  if (pct >= 25) return "#1eff00";
  return "#9ca3af";
}

const VERDICT_STYLE: Record<Fit["verdict"], { label: string; color: string }> = {
  fit: { label: "FIT", color: "#22c55e" },
  borderline: { label: "BORDERLINE", color: "#eab308" },
  no: { label: "NOT A FIT", color: "#ef4444" },
};

export function AnalysesClient() {
  const [region, setRegion] = useState("eu");
  const [realmText, setRealmText] = useState("");
  const [selectedRealm, setSelectedRealm] = useState<RealmOption | null>(null);
  const [allRealms, setAllRealms] = useState<RealmOption[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the region's realms once (cached); typing filters client-side.
  useEffect(() => {
    let cancelled = false;
    setSelectedRealm(null);
    setAllRealms((prev) => (realmCache.has(region) ? prev : []));
    loadRealms(region).then((realms) => { if (!cancelled) setAllRealms(realms); });
    return () => { cancelled = true; };
  }, [region]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const matches = useMemo(() => {
    const q = realmText.trim().toLowerCase();
    if (!q) return allRealms.slice(0, 8);
    return allRealms.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8);
  }, [realmText, allRealms]);

  function pickRealm(r: RealmOption) {
    setSelectedRealm(r);
    setRealmText(r.name);
    setDropdownOpen(false);
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    // Resolve to a real slug — never free-text (matches PlayerSearchBar).
    const realmSlug =
      selectedRealm?.name === realmText.trim()
        ? selectedRealm.slug
        : allRealms.find((r) => r.name.toLowerCase() === realmText.trim().toLowerCase())?.slug;
    if (!realmSlug) {
      setError("Pick a realm from the list.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ region, realm: realmSlug, name: name.trim() });
      if (target.trim()) params.set("target", target.trim());
      const res = await apiFetch<Result>(`/api/analyses?${params}`);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={run} className="panel p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Region
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm w-20">
            {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400 relative">
          Realm
          <div ref={boxRef} className="relative w-52">
            <input
              value={realmText}
              onChange={(e) => { setRealmText(e.target.value); setSelectedRealm(null); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder={allRealms.length ? "Realm" : "Loading realms…"}
              disabled={!allRealms.length}
              className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm disabled:opacity-50"
            />
            {dropdownOpen && matches.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 panel max-h-56 overflow-y-auto shadow-card">
                {matches.map((r) => (
                  <button key={r.id} type="button" onClick={() => pickRealm(r)}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-panel2 hover:text-white">
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Character
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm w-40" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Apply for +
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="22" inputMode="numeric" className="bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm w-20" />
        </label>
        <button type="submit" disabled={loading} className="btn bg-accent text-black hover:brightness-110 disabled:opacity-50">
          {loading ? "Scanning…" : "Scan"}
        </button>
      </form>

      {loading && (
        <div className="panel p-6 text-center text-sm text-gray-400">
          Pulling every run&apos;s combat detail from Warcraft Logs. A cold scan of 8 dungeons can take a minute.
        </div>
      )}
      {error && <div className="panel p-4 text-sm text-red-400">{error}</div>}
      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const { meta, fit, overall, dungeons } = result;
  const spec = meta.specId ? specById(meta.specId) : undefined;
  const color = classColor(meta.classId as ClassId);
  const verdict = VERDICT_STYLE[fit.verdict];

  return (
    <div className="space-y-5">
      {/* header + verdict */}
      <div className="panel p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="text-xl font-black" style={{ color }}>{meta.name}</div>
          <div className="text-xs text-gray-400">
            {spec ? spec.name : meta.classId} · {meta.realm}-{meta.region}
            {meta.ilvl != null && ` · ${meta.ilvl} ilvl`}
            {meta.interrupt && ` · kick: ${meta.interrupt.name}`}
            {` · avoidable dataset: ${meta.avoidableVersion}`}
          </div>
        </div>
        {meta.rating != null && (
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: ratingTier(meta.rating).hex }}>{Math.round(meta.rating)}</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500">Rating</div>
          </div>
        )}
        <div className="text-center px-4 py-2 rounded-lg" style={{ background: `${verdict.color}22`, border: `1px solid ${verdict.color}` }}>
          <div className="text-lg font-black" style={{ color: verdict.color }}>{verdict.label}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">
            score {fit.score}{fit.referenceLevel != null && ` · vs +${fit.referenceLevel}`}
          </div>
        </div>
      </div>

      {/* fit reasons */}
      <div className="panel p-4">
        <h3 className="text-sm font-bold mb-2">Why</h3>
        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
          {fit.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      {/* overall */}
      <div className="panel p-4">
        <h3 className="text-sm font-bold mb-3">Overall (best run per dungeon · {overall.dungeonsWithData} dungeons)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-md bg-panel2 py-2">
            <div className="text-base font-black tabular-nums" style={{ color: parseTierColor(overall.score) }}>{overall.score ?? "-"}</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500">Score</div>
          </div>
          <Stat label="DPS" value={fmt(overall.dps)} />
          <Stat label="HPS" value={fmt(overall.hps)} />
          <Stat label="Damage" value={fmt(overall.damage)} />
          <Stat label="Healing" value={fmt(overall.healing)} />
          <Stat label="Dmg taken" value={fmt(overall.damageTaken)} />
          <Stat label="Interrupts" value={String(overall.interrupts)} />
          {overall.dispels != null && <Stat label="Dispels / Purges" value={`${overall.dispels} / ${overall.purges ?? 0}`} />}
          <Stat label="Deaths" value={String(overall.deaths)} />
          <Stat label="Defensives (mitig.)" value={`${overall.defensiveUses} (${overall.defensiveMitigated})`} />
          <Stat label="Externals cast" value={String(overall.externalUses)} />
        </div>
      </div>

      {/* per-dungeon */}
      <div className="space-y-3">
        {dungeons.map((d) => <DungeonCard key={d.dungeon.encounterID} d={d} color={color} />)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel2 py-2">
      <div className="text-base font-black tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}

function DungeonCard({ d, color }: { d: DungeonResult; color: string }) {
  const [open, setOpen] = useState(false);
  const best = d.runs[0];
  const fc = d.fieldCompare;
  return (
    <div className="panel p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="text-xs text-gray-500">{open ? "▼" : "▶"}</span>
        <div className="flex-1">
          <div className="font-bold">{d.dungeon.name}</div>
          <div className="text-xs text-gray-400">Levels: {levelDist(d.levels)}{d.maxLevel != null && ` · peak +${d.maxLevel}`}</div>
        </div>
        {best && <div className="text-right text-sm tabular-nums"><b>{fmt(best.overall.dps)}</b><div className="text-[10px] text-gray-500">DPS</div></div>}
        <div className="text-right text-sm tabular-nums w-16">
          <b style={{ color: parseTierColor(d.score) }}>{d.score != null ? d.score : "-"}</b>
          <div className="text-[10px] text-gray-500">score</div>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {!best && <div className="text-sm text-gray-500">No logged runs with combat detail.</div>}
          {best && (
            <>
              {fc && (
                <div className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Score <b style={{ color: parseTierColor(d.score) }}>{d.score ?? "-"}</b> · WCL parse <b style={{ color: parseTierColor(fc.parsePercent) }}>{fc.parsePercent != null ? `p${fc.parsePercent}` : "-"}</b> @ +{d.maxLevel}</span>
                  {fc.topName && fc.topDps != null && (
                    <span>Top parser: <b className="text-gray-200">{fc.topName}</b> {fmt(fc.topDps)} dps</span>
                  )}
                  {fc.fieldMedianDps != null && <span>Field median {fmt(fc.fieldMedianDps)} · best {fmt(fc.fieldBestDps)} · n={fc.fieldSize}</span>}
                </div>
              )}
              {/* score breakdown — why the number is what it is */}
              {d.scoreBreakdown.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                    Score {d.score} = weighted
                  </h4>
                  <div className="space-y-1">
                    {d.scoreBreakdown.map((p) => (
                      <div key={p.key} className="flex items-center gap-2 text-xs">
                        <span className="w-40 text-gray-400">{p.label}</span>
                        <div className="flex-1 h-3 rounded bg-panel2 overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${p.value}%`, background: parseTierColor(p.value) }} />
                        </div>
                        <span className="w-10 text-right tabular-nums text-gray-300">{p.value}</span>
                        <span className="w-16 text-right tabular-nums text-gray-500">×{p.weight} = {p.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* per-boss board — bars colored by the dungeon score tier */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Per boss (best run) · damage on boss</h4>
                {best.bosses.length === 0 && <div className="text-xs text-gray-500">No boss splits.</div>}
                {best.bosses.map((b, i) => {
                  const maxDps = Math.max(...best.bosses.map((x) => x.dps), 1);
                  return (
                    <BoardRow
                      key={b.encounterID ?? i}
                      rank={i + 1}
                      color={parseTierColor(d.score)}
                      title={b.name ?? `Boss ${i + 1}`}
                      subtitle={`${fmt(b.damage)} dmg${b.bossOnly === false ? " (incl. adds)" : ""} · ${fmt(b.healing)} heal`}
                      pct={(b.dps / maxDps) * 100}
                      value={fmt(b.dps)}
                      meta={`${fmt(b.hps)} hps`}
                    />
                  );
                })}
              </div>

              {/* run detail chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <Stat label="Interrupts" value={String(best.overall.interruptsLanded)} />
                {best.overall.dispels != null && <Stat label="Dispels / Purges" value={`${best.overall.dispels} / ${best.overall.purges ?? 0}`} />}
                <Stat label="Dmg taken" value={fmt(best.overall.damageTaken)} />
                <Stat
                  label={best.overall.avoidableCounted ? "Avoidable taken" : "Avoidable (no data)"}
                  value={best.overall.avoidableCounted ? `${fmt(best.overall.avoidableDamage)} · ${best.overall.avoidableHits} hits` : "-"}
                />
                <Stat label="Deaths" value={String(best.overall.deaths.length)} />
              </div>
              {best.overall.avoidableCounted && best.overall.avoidableAbilities.length > 0 && (
                <div className="text-xs text-gray-400">
                  <b className="text-gray-300">Avoidable hits:</b>{" "}
                  {best.overall.avoidableAbilities.map((x) => `${x.name} ${fmt(x.amount)} (${x.hits}×, ${x.severity})`).join(", ")}
                </div>
              )}

              {best.overall.defensives.length > 0 && (
                <div className="text-xs text-gray-400">
                  <b className="text-gray-300">Defensives:</b>{" "}
                  {best.overall.defensives.map((x) => `${x.name} ×${x.uses}${x.mitigated ? ` (mitigated ${fmt(x.mitigatedAmount)})` : ""}`).join(", ")}
                </div>
              )}
              {best.overall.externals.length > 0 && (
                <div className="text-xs text-gray-400">
                  <b className="text-gray-300">Externals cast:</b>{" "}
                  {best.overall.externals.map((x) => `${x.name} ×${x.casts}`).join(", ")}
                </div>
              )}
              {best.overall.deaths.length > 0 && (
                <div className="text-xs text-gray-400">
                  <b className="text-gray-300">Death causes:</b>{" "}
                  {best.overall.deaths.map((x) => x.topAbility ?? "unknown (no killing blow - likely lack of heal)").join(", ")}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
