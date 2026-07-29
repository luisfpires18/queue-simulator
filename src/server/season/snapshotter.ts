// Daily snapshot of every character's rating/roster state into the season
// currently marked "current" (src/data/appSettings.ts) - see
// CharacterSeasonSnapshot's schema comment for why this needs to run BEFORE
// a season rollover, not after (Character.rating/CharacterSpecTrack.bnetScore
// are live values overwritten on every sync, with nothing else in the
// schema preserving a season's numbers). Only ever touches whichever
// season is currently active, so switching the admin toggle to a new season
// naturally freezes the old one - no rollover-detection logic needed here.
//
// Same globalThis-singleton idiom as src/server/groups/expirySweeper.ts,
// started from the same src/instrumentation.ts hook.
import { getCurrentSeasonId } from "@/data/appSettings";
import { snapshotAllCharacters } from "@/data/seasonHistory";
import { isFeatureEnabled } from "@/data/featureFlags";

const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

class SeasonSnapshotter {
  private timer: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.timer) return;
    console.log("seasonSnapshotter: started (snapshotting every 24h)");
    void this.snapshot();
    this.timer = setInterval(() => void this.snapshot(), SNAPSHOT_INTERVAL_MS);
  }

  private async snapshot() {
    try {
      // Checked every tick (not just at start()) so an admin flipping the
      // "seasonSnapshotter" flag off/on (see Admin -> Feature Flags) takes
      // effect within the day without needing a restart.
      if (!(await isFeatureEnabled("seasonSnapshotter"))) return;
      const seasonId = await getCurrentSeasonId();
      const count = await snapshotAllCharacters(seasonId);
      console.log(`seasonSnapshotter: snapshotted ${count} character(s) for ${seasonId}`);
    } catch (err) {
      // Next tick retries; nothing to tear down.
      console.error("seasonSnapshotter run failed", err);
    }
  }
}

const g = globalThis as unknown as { __seasonSnapshotter?: SeasonSnapshotter };
export const seasonSnapshotter = (g.__seasonSnapshotter ??= new SeasonSnapshotter());
