"use client";

import { useMemo, useRef, useState } from "react";
import { fmtK, fmtSec, fmtTime, castKindColor } from "@/game/wclFormat";

interface Series {
  points: { tSec: number; dps: number }[];
  durationMs: number;
  totalDamage: number;
  label: string;
}
interface CastEvent {
  tSec: number;
  kind: string;
  name: string;
}

const CHART_L = 56;
const CHART_R = 12;
const CHART_T = 24;
const CHART_B = 22;
const CHART_W = 760;
const CHART_H = 260;
const DPS_MINE_COLOR = "#4dabf7";
const DPS_OTHER_COLOR = "#e268a8";

// Ported from wcl-parse-improver's public/js/chart.js dpsChartSvg()/wireDpsBrush().
export function DpsChart({
  mine,
  other,
  castOrder,
}: {
  mine: Series;
  other: Series;
  castOrder: { mine: CastEvent[]; them: CastEvent[] };
}) {
  const plotW = CHART_W - CHART_L - CHART_R;
  const plotH = CHART_H - CHART_T - CHART_B;
  const maxSec = Math.max(
    mine.points.at(-1)?.tSec ?? 0,
    other.points.at(-1)?.tSec ?? 0,
    mine.durationMs / 1000,
    other.durationMs / 1000
  );
  const maxDps = Math.max(1, ...mine.points.map((p) => p.dps), ...other.points.map((p) => p.dps));
  const x = (sec: number) => CHART_L + (maxSec > 0 ? (sec / maxSec) * plotW : 0);
  const y = (dps: number) => CHART_T + plotH - (dps / maxDps) * plotH;

  const [win, setWin] = useState<[number, number]>([0, maxSec]);
  const [brush, setBrush] = useState<{ x: number; w: number } | null>(null);
  const dragStart = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const toViewX = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * CHART_W;
  };
  const toSec = (vx: number) => Math.max(0, Math.min(maxSec, ((vx - CHART_L) / plotW) * maxSec));
  const secToX = (sec: number) => CHART_L + (sec / maxSec) * plotW;

  function onMouseDown(e: React.MouseEvent) {
    dragStart.current = toViewX(e.clientX);
    const onMove = (ev: MouseEvent) => {
      if (dragStart.current == null) return;
      const x1 = toViewX(ev.clientX);
      setBrush({ x: Math.min(dragStart.current, x1), w: Math.abs(x1 - dragStart.current) });
    };
    const onUp = (ev: MouseEvent) => {
      if (dragStart.current == null) return;
      const x1 = toViewX(ev.clientX);
      let a = toSec(Math.min(dragStart.current, x1));
      let b = toSec(Math.max(dragStart.current, x1));
      if (b - a < 4) {
        const c = toSec(x1);
        a = Math.max(0, c - 20);
        b = Math.min(maxSec, c + 20);
        setBrush({ x: secToX(a), w: secToX(b) - secToX(a) });
      }
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setWin([a, b]);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
  }

  function reset() {
    setBrush(null);
    setWin([0, maxSec]);
  }

  const poly = (points: { tSec: number; dps: number }[]) => points.map((p) => `${x(p.tSec).toFixed(1)},${y(p.dps).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="xMinYMin meet" className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const gy = CHART_T + plotH - frac * plotH;
          return (
            <g key={frac}>
              <line x1={CHART_L} x2={CHART_L + plotW} y1={gy} y2={gy} stroke="#23272e" strokeWidth={1} opacity={0.5} />
              <text x={CHART_L - 6} y={gy + 3} fontSize={9} fill="#8b93a1" textAnchor="end">{fmtK(frac * maxDps)}</text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <text key={frac} x={CHART_L + frac * plotW} y={CHART_T + plotH + 14} fontSize={9} fill="#8b93a1" textAnchor={frac === 0 ? "start" : frac === 1 ? "end" : "middle"}>
            {fmtSec(frac * maxSec)}
          </text>
        ))}
        <polyline fill="none" stroke={DPS_OTHER_COLOR} strokeWidth={2} strokeLinejoin="round" points={poly(other.points)} />
        <polyline fill="none" stroke={DPS_MINE_COLOR} strokeWidth={2} strokeLinejoin="round" points={poly(mine.points)} />
        <line x1={CHART_L} x2={CHART_L + 16} y1={12} y2={12} stroke={DPS_MINE_COLOR} strokeWidth={2} />
        <text x={CHART_L + 22} y={15} fontSize={10} fill="#d7dadf">You ({fmtK(mine.totalDamage / (mine.durationMs / 1000))} avg)</text>
        <line x1={CHART_L + 180} x2={CHART_L + 196} y1={12} y2={12} stroke={DPS_OTHER_COLOR} strokeWidth={2} />
        <text x={CHART_L + 202} y={15} fontSize={10} fill="#d7dadf">{other.label} ({fmtK(other.totalDamage / (other.durationMs / 1000))} avg)</text>
        {brush && <rect x={brush.x} y={CHART_T} width={brush.w} height={plotH} fill="#5fd0c5" opacity={0.16} pointerEvents="none" />}
        <rect x={CHART_L} y={CHART_T} width={plotW} height={plotH} fill="transparent" style={{ cursor: "crosshair" }} onMouseDown={onMouseDown} />
      </svg>
      <p className="text-[11px] text-gray-500 mt-1">
        5-second bins of effective damage (includes pets). <b>Drag across the chart</b> to see only the casts from that window.
      </p>
      <CastOrderCols mine={castOrder.mine} them={castOrder.them} otherLabel={other.label} win={win} onReset={reset} />
    </div>
  );
}

const ORD_DISPLAY_CAP = 150;

function CastOrderColumn({ list, title }: { list: CastEvent[]; title: string }) {
  const amps = list.filter((c) => c.kind === "amp");
  const shown = list.slice(0, ORD_DISPLAY_CAP);
  const cut = list.length - shown.length;
  return (
    <div className="flex-1 min-w-0 rounded-md border border-panelborder overflow-hidden">
      <div className="text-xs font-semibold px-2 pt-2 pb-1">{title} <small className="text-gray-500 font-normal">({list.length})</small></div>
      {amps.length ? (
        <div className="border-b border-panelborder bg-accent/10">
          <div className="text-[11px] font-semibold text-accent px-2 py-1">Cooldowns &amp; consumables ({amps.length})</div>
          <ol className="space-y-0.5 max-h-36 overflow-y-auto pb-1">
            {amps.map((c, i) => (
              <li key={i} className="text-xs px-2 whitespace-nowrap"><span className="text-gray-500 mr-1.5">{fmtTime(c.tSec * 1000)}</span><span style={{ color: castKindColor("amp") }}>{c.name}</span></li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="text-[11px] text-gray-600 px-2 py-1 border-b border-panelborder">No cooldowns or consumables in this window</div>
      )}
      <ol className="space-y-0.5 max-h-[340px] overflow-y-auto py-1">
        {shown.map((c, i) => (
          <li key={i} className={`px-2 ${c.kind === "amp" ? "font-semibold bg-accent/10" : ""}`}>
            <span className="text-xs text-gray-500 mr-1.5">{fmtTime(c.tSec * 1000)}</span>
            <span className="text-xs" style={{ color: castKindColor(c.kind) }}>{c.name}</span>
          </li>
        ))}
        {cut > 0 && <li className="text-[11px] text-gray-600 pt-1 px-2">…and {cut} more casts below - brush a smaller window on the chart to read them</li>}
      </ol>
    </div>
  );
}

function CastOrderCols({
  mine,
  them,
  otherLabel,
  win,
  onReset,
}: {
  mine: CastEvent[];
  them: CastEvent[];
  otherLabel: string;
  win: [number, number];
  onReset: () => void;
}) {
  const [lo, hi] = win;
  const inWin = (c: CastEvent) => c.tSec >= lo && c.tSec <= hi;
  const filteredMine = mine.filter(inWin);
  const filteredThem = them.filter(inWin);
  const whole = lo <= 0;
  return (
    <div className="mt-3">
      <div className="text-[11px] text-gray-500 mb-2">
        Rotation for <b>{whole ? "whole run" : `${fmtSec(lo)}-${fmtSec(hi)}`}</b> - drag on the chart above to inspect any window
        {!whole && (
          <>
            {" · "}
            <button onClick={onReset} className="text-accent underline">reset to whole run</button>
          </>
        )}
      </div>
      <div className="flex gap-4">
        <CastOrderColumn list={filteredThem} title={`${otherLabel} - cast order`} />
        <CastOrderColumn list={filteredMine} title="You - cast order" />
      </div>
    </div>
  );
}
