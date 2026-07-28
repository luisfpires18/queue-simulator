"use client";

import { useEffect, useState } from "react";

const INTERVAL_MS = 1000;
const subscribers = new Set<(now: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureTicking() {
  if (intervalId != null) return;
  intervalId = setInterval(() => {
    const now = Date.now();
    for (const notify of subscribers) notify(now);
  }, INTERVAL_MS);
}

function stopIfIdle() {
  if (subscribers.size === 0 && intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** One shared setInterval backing every subscriber instead of each owning
 * its own - a board with ~20 visible CountdownLights otherwise means ~20
 * independent per-second timers ticking concurrently.
 *
 * `now` starts null and is only ever set from an effect (never the
 * initializer) - a value read during the initial render would differ
 * between the server-rendered HTML and the client's first render, causing a
 * hydration mismatch. Rendering nothing until the effect fires keeps the
 * server and client's first paint identical. */
export function useSharedClock(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    subscribers.add(setNow);
    ensureTicking();
    return () => {
      subscribers.delete(setNow);
      stopIfIdle();
    };
  }, []);

  return now;
}
