"use client";

import { fmtTime, seriesColor } from "@/game/wclFormat";

interface Run {
  label: string;
  durationMs: number;
  idleWindows: { startMs: number; durMs: number }[];
  deaths: { atMs: number }[];
  buffLanes: { name: string; bands: { startMs: number; endMs: number }[] }[];
  lanes: { name: string; casts: number[] }[];
}

const LEFT_LABEL_W = 132;
const PLOT_W = 700;
const ROW_H = 20;
const RIGHT_PAD = 8;

// Ported from wcl-parse-improver's public/js/chart.js timelineSvg().
function TimelineRunSvg({ run, buffLaneNames }: { run: Run; buffLaneNames: string[] }) {
  const nBuff = buffLaneNames.length;
  const rows = run.lanes.length + nBuff + 2;
  const topPad = 4;
  const axisH = 20;
  const height = topPad + rows * ROW_H + axisH;
  const width = LEFT_LABEL_W + PLOT_W + RIGHT_PAD;
  const dur = Math.max(1, run.durationMs);
  const x = (ms: number) => LEFT_LABEL_W + (Math.min(Math.max(ms, 0), dur) / dur) * PLOT_W;
  const rowY = (i: number) => topPad + i * ROW_H;

  const Label = ({ i, text, color }: { i: number; text: string; color: string }) => (
    <g>
      <rect x={LEFT_LABEL_W - 122} y={rowY(i) + ROW_H / 2 - 4} width={8} height={8} rx={2} fill={color} />
      <text x={LEFT_LABEL_W - 110} y={rowY(i) + ROW_H / 2 + 3.5} fontSize={10} fill="#8b93a1">{text}</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMin meet" className="w-full">
      <Label i={0} text="Idle" color="#ffb84d" />
      {run.idleWindows.map((w, i) => {
        const x1 = x(w.startMs);
        const x2 = x(w.startMs + w.durMs);
        return (
          <rect key={i} x={x1} y={rowY(0) + 3} width={Math.max(1.5, x2 - x1)} height={ROW_H - 6} rx={3} fill="#ffb84d">
            <title>Idle {(w.durMs / 1000).toFixed(1)}s at {fmtTime(w.startMs)}</title>
          </rect>
        );
      })}

      <Label i={1} text="Deaths" color="#ff5d5d" />
      {run.deaths.map((d, i) => (
        <circle key={i} cx={x(d.atMs)} cy={rowY(1) + ROW_H / 2} r={5} fill="#ff5d5d" stroke="#101215" strokeWidth={2}>
          <title>Death at {fmtTime(d.atMs)}</title>
        </circle>
      ))}

      {buffLaneNames.map((name, bi) => {
        const i = bi + 2;
        const color = seriesColor(bi);
        const bands = run.buffLanes.find((l) => l.name === name)?.bands ?? [];
        return (
          <g key={name}>
            <Label i={i} text={name} color={color} />
            {bands.map((b, j) => {
              const x1 = x(b.startMs);
              const x2 = x(b.endMs);
              return (
                <rect key={j} x={x1} y={rowY(i) + 4} width={Math.max(1.5, x2 - x1)} height={ROW_H - 8} rx={2} fill={color} fillOpacity={0.42} stroke={color} strokeWidth={1}>
                  <title>{name} - {fmtTime(b.startMs)} to {fmtTime(b.endMs)}</title>
                </rect>
              );
            })}
          </g>
        );
      })}

      {run.lanes.map((lane, li) => {
        const i = li + 2 + nBuff;
        const color = seriesColor(li);
        return (
          <g key={lane.name}>
            <Label i={i} text={lane.name} color={color} />
            {lane.casts.map((ts, j) => (
              <line key={j} x1={x(ts)} x2={x(ts)} y1={rowY(i) + 3} y2={rowY(i) + ROW_H - 3} stroke={color} strokeWidth={2} strokeLinecap="round">
                <title>{lane.name} at {fmtTime(ts)}</title>
              </line>
            ))}
          </g>
        );
      })}

      {nBuff > 0 && (
        <line x1={LEFT_LABEL_W - 126} x2={LEFT_LABEL_W + PLOT_W} y1={rowY(2 + nBuff) - 1} y2={rowY(2 + nBuff) - 1} stroke="#23272e" strokeWidth={1} strokeDasharray="3 3" />
      )}

      <line x1={LEFT_LABEL_W} x2={LEFT_LABEL_W + PLOT_W} y1={topPad + rows * ROW_H + 4} y2={topPad + rows * ROW_H + 4} stroke="#23272e" strokeWidth={1} />
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <text key={frac} x={LEFT_LABEL_W + frac * PLOT_W} y={topPad + rows * ROW_H + 16} fontSize={9} fill="#8b93a1" textAnchor={frac === 0 ? "start" : frac === 1 ? "end" : "middle"}>
          {fmtTime(frac * dur)}
        </text>
      ))}
    </svg>
  );
}

export function TimelineSection({
  timeline,
}: {
  timeline: { laneNames: string[]; buffLaneNames?: string[]; mine: Run; other: Run } | null;
}) {
  if (!timeline || !timeline.laneNames.length) return null;
  const buffLaneNames = timeline.buffLaneNames ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-gray-500">
        Ticks = individual casts. Only cooldown-gated abilities get a lane - fillers are in the per-ability table further down.
        {buffLaneNames.length > 0 && " Filled bars above the dashed line = your buff windows (procs, cooldowns, trinkets)."} The two runs have different durations, so each has its own time axis.
      </p>
      <div>
        <div className="text-xs text-gray-500 mb-1">You · duration {fmtTime(timeline.mine.durationMs)}</div>
        <TimelineRunSvg run={timeline.mine} buffLaneNames={buffLaneNames} />
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1">{timeline.other.label} · duration {fmtTime(timeline.other.durationMs)}</div>
        <TimelineRunSvg run={timeline.other} buffLaneNames={buffLaneNames} />
      </div>
    </div>
  );
}
