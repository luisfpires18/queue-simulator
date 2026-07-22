"use client";

import { useEffect, useState } from "react";
import { fmtK, fmtPct, pctColor, tierColor, median, EMPTY } from "@/game/wclFormat";
import { TimelineSection } from "./TimelineSvg";
import { DpsChart } from "./DpsChart";

// Loose view model — mirrors the JSON shape from POST buildReport() in the
// ported src/server/analysis/compare.js. Kept permissive (not exhaustively
// typed) since this is purely a rendering layer over server-computed data,
// same as the original vanilla-JS renderer it replaces.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportViewModel = any;

export function ReportView({
  view,
  levels = [],
  level,
  onLevelChange,
  onCompareChange,
  onRefresh,
  characterId,
  specId,
  encounterID,
  compareTo,
  refreshToken,
  embeddedChart,
}: {
  view: ReportViewModel;
  levels?: number[];
  level?: number;
  onLevelChange?: (l: number) => void;
  onCompareChange: (name: string) => void;
  onRefresh: () => void;
  characterId?: string;
  specId?: string;
  encounterID?: number;
  compareTo: string;
  refreshToken: number;
  // Raid pulls embed their own DPS series in the report response (mine/other) —
  // pass it here to skip VsSection's M+-only /api/wcl/dps-series fetch.
  embeddedChart?: { mine: any; other: any; otherLabel: string };
}) {
  const h = view.headline;
  const { top = [], similar = [], selected } = view.compare ?? {};
  return (
    <div className="panel p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">
          {h.title} {h.subtitle}
        </h2>
        {h.myBestPercent != null && (
          <span style={{ color: pctColor(h.myBestPercent) }}>{h.myBestPercent}% <small className="text-gray-500">parse</small></span>
        )}
        <button onClick={onRefresh} className="btn-ghost text-xs px-2 py-1 ml-auto" title="Re-fetch this report, bypassing the local cache">
          ↻ Refresh
        </button>
      </div>

      {/* Comparison picker lives outside the collapsible sections — changing
          opponent/level shouldn't require opening a section first. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span>Compare against:</span>
        <select
          value={selected ?? ""}
          onChange={(e) => onCompareChange(e.target.value)}
          className="bg-panel2 border border-panelborder rounded px-1.5 py-1"
        >
          <optgroup label={`Top ${top.length}`}>
            {top.map((p: any) => (
              <option key={p.name} value={p.name}>#{p.rank} {p.name} - {fmtK(p.dps)}</option>
            ))}
          </optgroup>
          {similar.length > 0 && (
            <optgroup label="Parses most like your run">
              {similar.map((p: any) => (
                <option key={p.name} value={p.name}>{p.name} - {p.matchPct}% route match, {fmtK(p.dps)}</option>
              ))}
            </optgroup>
          )}
        </select>
        {levels.length > 0 && (
          <>
            <span>at level:</span>
            {levels.map((l) => (
              <button key={l} onClick={() => onLevelChange?.(l)} className={`chip border ${l === level ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}>
                +{l}
              </button>
            ))}
          </>
        )}
      </div>

      <SummarySection s={view.summary} />
      <VsSection
        view={view}
        level={level}
        characterId={characterId}
        specId={specId}
        encounterID={encounterID}
        compareTo={compareTo}
        refreshToken={refreshToken}
        embeddedChart={embeddedChart}
      />
      <GapsSection gaps={view.gaps} />
      <TopSpellsSection a={view.abilities} />
      <RotationSection view={view} />
      <ConsumablesSection c={view.consumables} />
      <GearSection g={view.gear} />
      <ParseSection p={view.parse} />
      <ResourcesSection res={view.resources} />
      <AbilitiesSection a={view.abilities} />
      <CohortSection top={top} similar={similar} myDps={h.myDps} />
    </div>
  );
}

function Section({ title, sub, children, open = false }: { title: string; sub?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="border-t border-panelborder/60 pt-3" open={open}>
      <summary className="cursor-pointer select-none text-sm font-bold mb-2">
        {title} {sub && <small className="text-gray-500 font-normal">{sub}</small>}
      </summary>
      {children}
    </details>
  );
}

function VsSection({
  view,
  level,
  characterId,
  specId,
  encounterID,
  compareTo,
  refreshToken,
  embeddedChart,
}: {
  view: ReportViewModel;
  level?: number;
  characterId?: string;
  specId?: string;
  encounterID?: number;
  compareTo: string;
  refreshToken: number;
  embeddedChart?: { mine: any; other: any; otherLabel: string };
}) {
  const h = view.headline;
  const [chart, setChart] = useState<{ mine: any; other: any; otherLabel: string } | null>(embeddedChart ?? null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    if (embeddedChart || !characterId || !specId || encounterID == null) return;
    let cancelled = false;
    setChart(null);
    setChartError(null);
    const params = new URLSearchParams({ characterId, specId, encounter: String(encounterID), level: String(level) });
    if (compareTo) params.set("compareTo", compareTo);
    if (refreshToken) params.set("refresh", "1");
    fetch(`/api/wcl/dps-series?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setChart(data);
      })
      .catch((err) => {
        if (!cancelled) setChartError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, specId, encounterID, level, compareTo, refreshToken, embeddedChart]);

  const gap =
    h.dpsGapPct == null ? null : h.dpsGapPct > 0 ? (
      <b className="text-gray-400">{h.dpsGapPct}% behind</b>
    ) : (
      <b className="text-emerald-400">{Math.abs(h.dpsGapPct)}% ahead</b>
    );

  return (
    <Section title={`You vs ${h.otherLabel ?? EMPTY}`}>
      <p className="text-sm mb-3">
        <b>{fmtK(h.myDps)}</b> you &nbsp;vs&nbsp; <b>{fmtK(h.theirDps)}</b> them &nbsp;{gap}
      </p>
      {chartError ? (
        <p className="text-xs text-rose-300">DPS chart failed: {chartError}</p>
      ) : chart ? (
        <DpsChart mine={chart.mine} other={chart.other} castOrder={view.castOrder ?? { mine: [], them: [] }} />
      ) : (
        <p className="text-xs text-gray-500">Loading DPS over time…</p>
      )}
    </Section>
  );
}

// Not part of the single-opponent picker above (nor tied to whatever it has
// selected) - a cohort median only has dps/durationMs (already in top/similar
// from the ranked page fetched for that picker), never a full per-player run,
// so it can't feed gear/rotation/abilities/gaps the way one real opponent
// does. Standalone section, always available, always compares vs the group.
function CohortSection({ top, similar, myDps }: { top: any[]; similar: any[]; myDps: number | null }) {
  const [scope, setScope] = useState<"top" | "similar">("top");
  if (!top.length) return null;
  const list = scope === "top" ? top : similar;
  const dps = list.length ? median(list.map((p: any) => p.dps)) : null;
  const gapPct = dps && myDps ? Math.round(1000 * (1 - myDps / dps)) / 10 : null;
  const gap =
    gapPct == null ? null : gapPct > 0 ? (
      <b className="text-gray-400">{gapPct}% behind</b>
    ) : (
      <b className="text-emerald-400">{Math.abs(gapPct)}% ahead</b>
    );
  const label = scope === "top" ? `Top ${top.length}` : `similar route (${similar.length})`;

  return (
    <Section title="Cohort comparison" sub="median of a group, not one player">
      <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
        <span>Group:</span>
        <button onClick={() => setScope("top")} className={`chip border ${scope === "top" ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}>
          Top {top.length}
        </button>
        {similar.length > 0 && (
          <button onClick={() => setScope("similar")} className={`chip border ${scope === "similar" ? "border-accent text-accent" : "border-panelborder text-gray-400"}`}>
            Similar route ({similar.length})
          </button>
        )}
      </div>
      {dps != null ? (
        <p className="text-sm">
          <b>{fmtK(myDps)}</b> you &nbsp;vs&nbsp; <b>{fmtK(dps)}</b> {label} median &nbsp;{gap}
          <span className="text-gray-600"> &nbsp;({Math.round(dps).toLocaleString("en-US")} exact)</span>
        </p>
      ) : (
        <p className="text-xs text-gray-500">Not enough ranked runs to compute a median.</p>
      )}
      <p className="text-xs text-gray-500 mt-2">
        Group median only - gear/rotation/abilities/gaps above always compare against whichever single player is picked in &quot;Compare against&quot;, not this group.
      </p>
    </Section>
  );
}

function SummarySection({ s }: { s: any }) {
  if (!s) return null;
  return (
    <Section title="Overall read" open>
      <p className="text-sm mb-2">{s.diagnosis}</p>
      {s.topImprovements?.length > 0 && (
        <ol className="space-y-2 mb-2 list-decimal list-inside">
          {s.topImprovements.map((t: any, i: number) => (
            <li key={i} className="text-sm">
              <b>{t.title}</b>
              <p className="text-gray-400 ml-4">{t.advice}</p>
              <small className="text-gray-600 ml-4">rough estimate: {t.impactRangePct[0]}-{t.impactRangePct[1]}% DPS</small>
            </li>
          ))}
        </ol>
      )}
      {s.externalFactors?.length > 0 && (
        <>
          <p className="text-xs text-gray-500">What may be outside your control:</p>
          <ul className="list-disc list-inside text-sm text-gray-400 mb-2">
            {s.externalFactors.map((f: string, i: number) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}
      <p className="text-sm font-bold">{s.conclusion}</p>
    </Section>
  );
}

const GAPS_TOP_N = 5;

function GapsSection({ gaps }: { gaps: any[] }) {
  if (!gaps?.length) {
    return (
      <Section title="Biggest gaps">
        <p className="text-sm text-gray-500">Nothing stands out against this player.</p>
      </Section>
    );
  }
  const top = gaps.slice(0, GAPS_TOP_N);
  const rest = gaps.slice(GAPS_TOP_N);
  const Item = ({ g }: { g: any }) => {
    const p = g.priority ?? { rank: 3, label: "Low" };
    const stars = "★".repeat(4 - p.rank) + "☆".repeat(p.rank - 1);
    return (
      <li className="mb-3">
        <div className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="text-amber-400 text-xs" title={`Priority ${p.rank} of 3`}>{stars} {p.label}</span>
          <b>{g.title}</b>
          <span className="text-gray-400 text-xs">
            you <b>{String(g.mine)}</b>{g.unit ? ` ${g.unit}` : ""} · them <b>{String(g.cohort)}</b>{g.unit ? ` ${g.unit}` : ""}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{g.advice}</div>
        {g.behind?.length > 0 && (
          <table className="text-xs mt-1 w-full">
            <thead className="text-gray-500"><tr><th className="text-left">Ability</th><th>You (CPM)</th><th>Them (CPM)</th><th>Behind by</th></tr></thead>
            <tbody>
              {g.behind.map((b: any, i: number) => (
                <tr key={i}>
                  <td>{b.name}</td>
                  <td className="text-right tabular-nums">{b.myCpm}</td>
                  <td className="text-right tabular-nums">{b.theirCpm}</td>
                  <td className="text-right tabular-nums text-orange-400">−{b.cpmBehindBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </li>
    );
  };
  return (
    <Section title="Biggest gaps" sub="what stands out">
      <ol>{top.map((g, i) => <Item key={i} g={g} />)}</ol>
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-accent">Show all {gaps.length} findings ({rest.length} more)</summary>
          <ol className="mt-2">{rest.map((g, i) => <Item key={i} g={g} />)}</ol>
        </details>
      )}
    </Section>
  );
}

function TopSpellsSection({ a }: { a: any }) {
  if (!a?.rows?.length) return null;
  const t = a.totals || {};
  const rank = (key: string, totalKey: string) => {
    const list = a.rows.filter((r: any) => r[key] > 0).sort((x: any, y: any) => y[key] - x[key]).slice(0, 6);
    return { list, max: list[0]?.[key] || 1, sum: t[totalKey] || list.reduce((s: number, r: any) => s + r[key], 0) || 1 };
  };
  const mine = rank("myAmount", "myDamage");
  const theirs = rank("theirAmount", "theirDamage");
  if (!mine.list.length && !theirs.list.length) return null;
  const share = (v: number, sum: number) => Math.round((100 * v) / sum);

  const Column = ({ d, field }: { d: any; field: string }) => (
    <ol className="space-y-1">
      {d.list.map((r: any, i: number) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          <span className="w-24 truncate" title={r.name}>{r.name}</span>
          <span className="flex-1 h-2 rounded bg-panel2 overflow-hidden">
            <span className="block h-full bg-accent/70" style={{ width: `${Math.max(4, Math.round((100 * r[field]) / d.max))}%` }} />
          </span>
          <span className="w-9 text-right tabular-nums">{share(r[field], d.sum)}%</span>
        </li>
      ))}
    </ol>
  );

  return (
    <Section title="Top damage sources" sub={`you vs ${a.otherLabel}`}>
      <div className="grid grid-cols-2 gap-4">
        <div><h4 className="text-xs text-gray-500 mb-1">You</h4><Column d={mine} field="myAmount" /></div>
        <div><h4 className="text-xs text-gray-500 mb-1">{a.otherLabel}</h4><Column d={theirs} field="theirAmount" /></div>
      </div>
    </Section>
  );
}

function RotationSection({ view }: { view: ReportViewModel }) {
  if (!view.timeline) return null;
  const m = view.rotationMatch;
  return (
    <Section title="Rotation timeline">
      {m && (
        <p className="text-xs text-gray-500 mb-2">
          Rotation match: <b>{m.spellMixPct}%</b> spell mix · <b>{m.castOrderPct}%</b> cast order
        </p>
      )}
      <TimelineSection timeline={view.timeline} />
    </Section>
  );
}

function ParseSection({ p }: { p: any }) {
  if (!p) return null;
  return (
    <Section title="Parse & next colour">
      {p.currentPercent != null && (
        <p className="text-sm mb-2">
          This run: <b style={{ color: pctColor(p.currentPercent) }}>{fmtPct(p.currentPercent)}% {p.currentTier ?? ""}</b>
        </p>
      )}
      {p.tiers?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {p.tiers.map((t: any, i: number) => {
            const need = t.needDps ?? t.estDps;
            const sign = t.dpsDelta >= 0 ? "+" : "";
            const color = tierColor(t.tier);
            return (
              <span key={i} className="chip border" style={{ borderColor: `${color}66`, background: `${color}1a`, color }}>
                {t.tier} {t.threshold}%+<br />
                <small style={{ color }}>{sign}{t.pctDeltaNeeded}% DPS{need ? ` · ${fmtK(need)}` : ""}</small>
              </span>
            );
          })}
        </div>
      )}
      {p.text && <p className="text-xs text-gray-500">{p.text}</p>}
    </Section>
  );
}

function ConsumablesSection({ c }: { c: any }) {
  if (!c) return null;
  const cell = (v: any) => (v ? <>{v.name} <small className="text-gray-500">{v.pct}%</small></> : <span className="text-gray-600">none</span>);
  const pot = (p: any) => {
    if (!p || p.max == null) return <span className="text-gray-600">·</span>;
    const short = p.missed > 0;
    return (
      <>
        <b className={short ? "text-orange-400" : "text-emerald-400"}>{p.used}</b> <span className="text-gray-500">of {p.max} possible</span>
        {p.names.length > 0 && <small className="text-gray-500"> ({p.names.join(", ")})</small>}
      </>
    );
  };
  const gave = c.partyBuffs?.theyHadIDidnt ?? [];
  return (
    <Section title="Consumables & party buffs" sub={`you vs ${c.otherLabel}`}>
      <table className="text-xs w-full mb-2">
        <thead className="text-gray-500"><tr><th className="text-left">Consumable</th><th className="text-left">You</th><th className="text-left">{c.otherLabel}</th></tr></thead>
        <tbody>
          {c.rows.map((r: any, i: number) => (
            <tr key={i} className={r.missing ? "bg-rose-500/5" : ""}>
              <td>{r.label}</td><td>{cell(r.mine)}</td><td>{cell(r.them)}</td>
            </tr>
          ))}
          <tr className={c.potions?.mine?.missed > 0 ? "bg-rose-500/5" : ""}>
            <td>Potions</td><td>{pot(c.potions?.mine)}</td><td>{pot(c.potions?.them)}</td>
          </tr>
        </tbody>
      </table>
      {c.notes?.map((n: string, i: number) => <p key={i} className="text-xs text-gray-500 mb-1">{n}</p>)}
      {(c.partyBuffs?.them ?? []).length > 0 && (
        <>
          <h4 className="text-xs text-gray-500 mt-2 mb-1">Party buffs <small>applied to you by someone else</small></h4>
          <table className="text-xs w-full">
            <thead className="text-gray-500"><tr><th className="text-left">Buff</th><th className="text-left">You</th><th className="text-left">{c.otherLabel}</th></tr></thead>
            <tbody>
              {c.partyBuffs.them.map((b: any, i: number) => {
                const mineHas = (c.partyBuffs.mine ?? []).find((m: any) => m.name === b.name);
                return (
                  <tr key={i} className={mineHas ? "" : "bg-rose-500/5"}>
                    <td>{b.name}</td>
                    <td>{mineHas ? `${mineHas.pct}%` : <span className="text-gray-600">none</span>}</td>
                    <td>{b.pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {gave.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Their group gave them {gave.map((b: any) => b.name).join(", ")} and yours didn&apos;t. That&apos;s a real part of the DPS gap - and it is <b>not</b> your rotation.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

function GearSection({ g }: { g: any }) {
  if (!g?.rows?.length) return null;
  if (g.clean) {
    return (
      <Section title="Gear check" sub={`enchants & gems vs ${g.otherLabel}`}>
        <p className="text-sm"><span className="text-emerald-400">✓</span> {g.notes[0]}</p>
      </Section>
    );
  }
  const rows = g.rows.filter((r: any) => r.missingEnchant || r.missingGem);
  return (
    <Section title="Gear check" sub={`enchants & gems vs ${g.otherLabel}`}>
      <table className="text-xs w-full mb-2">
        <thead className="text-gray-500"><tr><th className="text-left">Slot</th><th className="text-left">Missing enchant</th><th className="text-left">Missing gem</th></tr></thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="bg-rose-500/5">
              <td>{r.label}</td>
              <td>{r.missingEnchant ? <span className="text-orange-400">✗</span> : <span className="text-gray-600">-</span>}</td>
              <td>{r.missingGem ? <><span className="text-orange-400">✗</span> <small className="text-orange-300">(they: {r.theirGems})</small></> : <span className="text-gray-600">-</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.notes.map((n: string, i: number) => <p key={i} className="text-xs text-amber-400">{n}</p>)}
    </Section>
  );
}

function ResourcesSection({ res }: { res: any }) {
  if (!res) return null;
  const cell = (v: any, suffix = "") => (v == null ? <span className="text-gray-600">·</span> : `${v}${suffix}`);
  const them = res.them;
  // Whichever side wastes more overcapping is the one that "failed" here —
  // flagged the same way the biggest-gaps table flags you being behind.
  const worseMine = them?.wastePct != null && res.mine.wastePct > them.wastePct;
  const worseThem = them?.wastePct != null && them.wastePct > res.mine.wastePct;
  return (
    <Section title={`${res.name} management`}>
      <table className="text-xs w-full mb-2">
        <thead className="text-gray-500"><tr><th className="text-left">Metric</th><th className="text-left">You</th><th className="text-left">Them</th></tr></thead>
        <tbody>
          <tr className="bg-panel2/50">
            <td><b>Wasted to overcapping</b></td>
            <td className={worseMine ? "text-orange-400 font-bold" : ""}>{cell(res.mine.wastePct, "%")}</td>
            <td className={worseThem ? "text-orange-400 font-bold" : ""}>{cell(them?.wastePct, "%")}</td>
          </tr>
          <tr><td>Generated</td><td>{cell(res.mine.gain)}</td><td>{cell(them?.gain)}</td></tr>
          <tr><td>Wasted</td><td>{cell(res.mine.waste)}</td><td>{cell(them?.waste)}</td></tr>
        </tbody>
      </table>
      {res.note && <p className="text-xs text-gray-500">{res.note}</p>}
    </Section>
  );
}

function AbilitiesSection({ a }: { a: any }) {
  if (!a?.rows?.length) return null;
  const fmtM = (v: number) => (v ? (v / 1e6).toFixed(1) + "m" : EMPTY);
  // orange = you cast it 25%+ less than them (or never); blue = 25%+ more (or they never did)
  const flag = (r: any) => {
    const max = Math.max(r.myCasts, r.theirCasts);
    if (max < 3) return null;
    if (r.myCasts === 0) return { row: "bg-orange-500/10", text: "text-orange-400" };
    if (r.theirCasts === 0) return { row: "bg-sky-500/10", text: "text-sky-400" };
    const rel = (r.theirCasts - r.myCasts) / r.theirCasts;
    if (rel >= 0.25) return { row: "bg-orange-500/10", text: "text-orange-400" };
    if (rel <= -0.25) return { row: "bg-sky-500/10", text: "text-sky-400" };
    return null;
  };
  const rows = a.rows.slice(0, 30);
  return (
    <Section title="Per-ability" sub={`you vs ${a.otherLabel}`}>
      <table className="text-xs w-full">
        <thead className="text-gray-500">
          <tr><th className="text-left">Ability</th><th>You</th><th>Them</th><th>Diff</th><th>Your dmg</th><th>Their dmg</th></tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => {
            const f = flag(r);
            return (
              <tr key={i} className={f?.row}>
                <td className={f?.text}>{r.name} {f && <span className="text-[10px]">●</span>}</td>
                <td className="text-right tabular-nums">{r.myCasts || EMPTY}</td>
                <td className="text-right tabular-nums">{r.theirCasts || EMPTY}</td>
                <td className="text-right tabular-nums">{r.castDiff > 0 ? "+" : ""}{r.castDiff || ""}</td>
                <td className="text-right tabular-nums">{fmtM(r.myAmount)}</td>
                <td className="text-right tabular-nums">{fmtM(r.theirAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-gray-400"><td>Total</td><td /><td /><td /><td className="text-right tabular-nums">{fmtM(a.totals.myDamage)}</td><td className="text-right tabular-nums">{fmtM(a.totals.theirDamage)}</td></tr>
        </tfoot>
      </table>
    </Section>
  );
}
