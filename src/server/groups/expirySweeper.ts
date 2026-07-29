// Hourly sweep of expired M+/Raid listings — soft-delists any Group whose
// startsAt + grace has passed (see isExpired/expireStaleGroups in
// src/data/groups.ts). Started once from instrumentation.ts's register()
// hook at server boot, unlike src/server/board/broadcaster.ts's tick (which
// only runs while an SSE client is connected) - this should run regardless
// of whether anyone's looking at the board.
//
// globalThis-stashed singleton, same idiom as boardBroadcaster/prisma.ts, so
// Next dev HMR can't spawn parallel tickers. Safe under future multi-instance
// scale-out too (unlike the board tick/matcher) - the underlying UPDATE is
// naturally idempotent, concurrent runs just no-op on already-delisted rows.
import { expireStaleGroups } from "@/data/groups";
import { isFeatureEnabled } from "@/data/featureFlags";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

class ExpirySweeper {
  private timer: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.timer) return;
    console.log("expirySweeper: started (sweeping every 1h)");
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  private async sweep() {
    try {
      // Checked every tick (not just at start()) so an admin flipping the
      // "expirySweeper" flag off/on (see Admin -> Feature Flags) takes
      // effect within the hour without needing a restart.
      if (!(await isFeatureEnabled("expirySweeper"))) return;
      const count = await expireStaleGroups();
      if (count > 0) console.log(`expirySweeper: delisted ${count} expired group(s)`);
    } catch (err) {
      // Next tick retries; nothing to tear down.
      console.error("expirySweeper sweep failed", err);
    }
  }
}

const g = globalThis as unknown as { __expirySweeper?: ExpirySweeper };
export const expirySweeper = (g.__expirySweeper ??= new ExpirySweeper());
