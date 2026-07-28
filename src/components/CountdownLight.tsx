"use client";

import { useSharedClock } from "@/lib/useSharedClock";
import { cn } from "@/lib/utils";

type Tier = "green" | "yellow" | "red";

// Green = starting soon (< 45m away), yellow = 45m-2h away, red = 2h+ away
// OR the proposed time has already passed - a "readiness" light, not an
// urgency warning (so "Forming now" is green, not red).
function tierFor(minutesAway: number | null): Tier {
  if (minutesAway == null) return "green"; // forming now
  if (minutesAway <= 0) return "red"; // expired
  if (minutesAway < 45) return "green";
  if (minutesAway < 120) return "yellow";
  return "red";
}

function formatElapsed(createdAt: string, now: number): { text: string; stale: boolean } {
  const totalMinutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours >= 24) {
    const d = Math.floor(totalHours / 24);
    const h = totalHours % 24;
    return { text: `Listed for ${d}d ${h}h`, stale: true };
  }
  const m = totalMinutes % 60;
  if (totalHours > 0) return { text: `Listed for ${totalHours}h ${m}m`, stale: false };
  if (m > 0) return { text: `Listed for ${m}m`, stale: false };
  return { text: "Listed just now", stale: false };
}

function formatCountdown(startsAt: string, now: number): string {
  const ms = new Date(startsAt).getTime() - now;
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `Starts in ${h}h ${m}m`;
  if (m > 0) return `Starts in ${m}m ${s}s`;
  return `Starts in ${s}s`;
}

const TIER_DOT: Record<Tier, string> = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  red: "bg-rose-400",
};

const WarningIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0">
    <path
      d="M8 1.5l7 12.5H1l7-12.5z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M8 6.2v3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="8" cy="11.8" r="0.9" fill="currentColor" />
  </svg>
);

/** Live countdown to a listing's start time with a red/yellow/green
 * readiness dot - green when forming now or starting within 45 minutes,
 * yellow 45m-2h out, red 2h+ out or already expired. A "forming now" listing
 * instead shows how long it's been up. Ticks off useSharedClock (one shared
 * per-second timer for every instance on the board) rather than owning its
 * own interval - see that hook for why `now` starts null. */
export function CountdownLight({ startsAt, createdAt }: { startsAt: string | null; createdAt: string }) {
  const now = useSharedClock();

  if (now == null) return null;

  const minutesAway = startsAt ? (new Date(startsAt).getTime() - now) / 60000 : null;
  const tier = tierFor(minutesAway);

  if (!startsAt) {
    const elapsed = formatElapsed(createdAt, now);
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
        <span className={cn("inline-block w-2 h-2 rounded-full", TIER_DOT[tier], tier === "green" && "animate-pulse")} />
        Forming now · {elapsed.text}
        {elapsed.stale && (
          <span className="inline-flex items-center gap-1 text-amber-400">
            <WarningIcon />
            might be stale
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
      <span className={cn("inline-block w-2 h-2 rounded-full", TIER_DOT[tier], tier === "green" && "animate-pulse")} />
      {formatCountdown(startsAt, now)}
    </span>
  );
}
