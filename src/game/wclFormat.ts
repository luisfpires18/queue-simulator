// Formatting shared by the parse-analysis views (ported from wcl-parse-improver's
// public/js/util.js). WCL's parse-percentile colour scale is universally recognised
// by WoW players, so it's kept as-is rather than remapped onto the app's own palette.
export const EMPTY = "·";

export function fmtPct(v: number | null | undefined): string {
  return typeof v === "number" ? v.toFixed(1) : EMPTY;
}

export function fmtTime(ms: number | null | undefined): string {
  if (typeof ms !== "number" || ms < 0) return EMPTY;
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtSec(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export function fmtK(v: number | null | undefined): string {
  return typeof v === "number" ? (v / 1000).toFixed(1) + "k" : EMPTY;
}

export function median(nums: number[]): number | null {
  const s = nums.filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** WCL parse colours: pink 99+, orange 95+, purple 75+, blue 50+, green 25+. */
export function pctColor(v: number | null | undefined): string {
  if (typeof v !== "number") return "#3a3850";
  if (v >= 99) return "#e268a8";
  if (v >= 95) return "#ff8000";
  if (v >= 75) return "#a335ee";
  if (v >= 50) return "#0070dd";
  if (v >= 25) return "#1eff00";
  return "#9d9d9d";
}

export const castKindColor = (kind: string) =>
  kind === "damage" ? "#0070dd" : kind === "amp" ? "#ff8000" : "#9d9d9d";

/** Parse-tier name (from parseTiers.js: gray/green/blue/purple/orange/pink) -> hex. */
const TIER_COLOR: Record<string, string> = {
  gray: "#9d9d9d",
  green: "#1eff00",
  blue: "#0070dd",
  purple: "#a335ee",
  orange: "#ff8000",
  pink: "#e268a8",
};
export const tierColor = (name: string | null | undefined) => (name && TIER_COLOR[name]) || "#9d9d9d";

export const SERIES_COLORS = [
  "#4dabf7", "#ff8787", "#69db7c", "#ffd43b", "#da77f2", "#66d9e8", "#ff922b", "#63e6be",
];
export const seriesColor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length];
