// Single-flight wrapper around the Solo Queue match pass. The pass is
// triggered from three uncoordinated places - the shared SSE board tick
// (src/server/board/broadcaster.ts), every 4s GET /api/solo-queue poll, and
// the retry right after a queue-sourced decline - so without coalescing,
// overlapping passes were the norm. matchOneQueueEntry's atomic claim keeps
// overlap *correct*, this keeps it *rare*: concurrent callers share the
// in-flight pass, and at most one follow-up pass is queued behind it.
//
// Stashed on globalThis (same idiom as src/lib/prisma.ts) so Next dev HMR
// and per-route bundling can't create parallel instances. Per-process by
// design - horizontally scaled deployments would each run their own passes,
// which stays correct (see the atomic claim) but redundant; a true
// multi-node setup should move this to a single worker.
import { runSoloQueueMatch } from "@/data/soloQueue";

class MatchRunner {
  private inFlight: Promise<void> | null = null;
  private rerunQueued = false;

  run(): Promise<void> {
    if (this.inFlight) {
      this.rerunQueued = true;
      return this.inFlight;
    }
    this.inFlight = (async () => {
      do {
        this.rerunQueued = false;
        await runSoloQueueMatch();
      } while (this.rerunQueued);
    })().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
}

const g = globalThis as unknown as { __soloQueueMatchRunner?: MatchRunner };
const matchRunner = (g.__soloQueueMatchRunner ??= new MatchRunner());

/** Runs a Solo Queue match pass, coalescing concurrent callers into one. */
export function runMatchPass(): Promise<void> {
  return matchRunner.run();
}
