"use client";

// One row of a ranking board: a bar whose length IS the number, so a page of
// them reads as a shape rather than a column of digits. Ported from
// wcl-parse-improver's public/js/util.js boardRow().
export function BoardRow({
  rank,
  color,
  title,
  subtitle,
  pct,
  value,
  meta,
  dim = false,
  onClick,
}: {
  rank: number;
  color: string;
  title: string;
  subtitle?: string;
  pct?: number | null;
  value: React.ReactNode;
  meta?: React.ReactNode;
  dim?: boolean;
  onClick?: () => void;
}) {
  const width = typeof pct === "number" ? Math.max(4, Math.min(100, pct)) : 0;
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${onClick ? "cursor-pointer hover:bg-panel2" : ""} ${dim ? "opacity-50" : ""}`}
    >
      <span className="w-5 text-right text-xs text-gray-500 tabular-nums">{rank}</span>
      <div className="flex-1 relative h-7 rounded bg-panel2 overflow-hidden">
        {width > 0 ? (
          <div
            className="absolute inset-y-0 left-0 flex items-center rounded px-2"
            style={{ width: `${width}%`, background: `${color}33`, borderRight: `2px solid ${color}` }}
          >
            <span className="truncate text-xs">
              <b>{title}</b>
              {subtitle && <small className="ml-1.5 text-gray-400">{subtitle}</small>}
            </span>
          </div>
        ) : (
          <span className="absolute inset-y-0 left-0 flex items-center px-2 truncate text-xs">
            <b>{title}</b>
            {subtitle && <small className="ml-1.5 text-gray-400">{subtitle}</small>}
          </span>
        )}
      </div>
      <b className="w-16 text-right text-sm tabular-nums">{value}</b>
      {meta && <div className="w-24 text-right text-xs text-gray-400">{meta}</div>}
    </div>
  );
}
