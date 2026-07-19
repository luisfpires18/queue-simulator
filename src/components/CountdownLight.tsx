"use client";

import { useEffect, useState } from "react";
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

function formatCountdown(startsAt: string | null, now: number): string {
  if (!startsAt) return "Forming now";
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

/** Live countdown to a listing's start time with a red/yellow/green
 * readiness dot - green when forming now or starting within 45 minutes,
 * yellow 45m-2h out, red 2h+ out or already expired. Ticks every second
 * while mounted.
 *
 * `now` starts null and is only ever set from an effect (never from the
 * initializer) - Date.now() read during the initial render would differ
 * between the server-rendered HTML and the client's first render, causing a
 * hydration mismatch. Rendering nothing until the effect fires keeps the
 * server and client's first paint identical; the real countdown appears an
 * instant later once mounted. */
export function CountdownLight({ startsAt }: { startsAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (!startsAt) return; // "Forming now" never changes - no need to tick
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  if (now == null) return null;

  const minutesAway = startsAt ? (new Date(startsAt).getTime() - now) / 60000 : null;
  const tier = tierFor(minutesAway);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-300">
      <span className={cn("inline-block w-2 h-2 rounded-full", TIER_DOT[tier], tier === "green" && "animate-pulse")} />
      {formatCountdown(startsAt, now)}
    </span>
  );
}
