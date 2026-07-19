// Shared fan-out for the live board SSE stream (/api/stream/board). One
// process-wide 4s tick queries the board and runs the Solo Queue match pass
// ONCE, then pushes the same serialized frame to every connected client -
// previously each connection ran its own interval, so N open tabs meant N
// full board queries and N match passes every 4s (and a leaked interval per
// disconnected tab).
//
// Stashed on globalThis (same idiom as src/lib/prisma.ts) so Next dev HMR
// can't spawn parallel tickers. Per-process by design: correct for `next
// dev` and a single-node `next start`. Multiple nodes would each tick on
// their own - functionally fine (the matcher's atomic claim tolerates
// concurrent passes) but redundant; true multi-node wants the tick in a
// single worker and fan-out via a shared pub/sub (e.g. Redis).
import { listGroups } from "@/data/groups";
import { runMatchPass } from "@/server/soloQueue/matchRunner";

const BOARD_INTERVAL_MS = 4000;
const PING_INTERVAL_MS = 15000;

type Subscriber = (chunk: string) => void;

class BoardBroadcaster {
  private subscribers = new Set<Subscriber>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastFrame: string | null = null;

  /** Registers a client; immediately sends the current board (freshly built
   * if this is the first subscriber, cached otherwise - preserving the old
   * per-connection behavior of a first frame right at connect time).
   * Returns the unsubscribe function. */
  subscribe(send: Subscriber): () => void {
    this.subscribers.add(send);
    if (this.lastFrame) {
      send(this.lastFrame);
      this.start();
    } else {
      // First frame ever: build it, then start the interval so the next
      // frame comes a full period later (same cadence a fresh connection
      // always saw).
      void this.tick().then(() => this.start());
    }
    return () => {
      this.subscribers.delete(send);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  private start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => void this.tick(), BOARD_INTERVAL_MS);
    this.pingTimer = setInterval(() => this.broadcast(`: ping\n\n`), PING_INTERVAL_MS);
  }

  private stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.tickTimer = null;
    this.pingTimer = null;
    this.lastFrame = null; // next subscriber gets a fresh board, not a stale cache
  }

  private async tick() {
    try {
      await runMatchPass();
      const groups = await listGroups();
      this.lastFrame = `event: board\ndata: ${JSON.stringify({ groups, ts: Date.now() })}\n\n`;
      this.broadcast(this.lastFrame);
    } catch (err) {
      // Next tick retries; the stream stays up.
      console.error("board broadcaster tick failed", err);
    }
  }

  private broadcast(chunk: string) {
    for (const send of this.subscribers) {
      try {
        send(chunk);
      } catch {
        // A client torn down mid-broadcast just misses this frame; its
        // route-level cancel() unsubscribes it.
      }
    }
  }
}

const g = globalThis as unknown as { __boardBroadcaster?: BoardBroadcaster };
export const boardBroadcaster = (g.__boardBroadcaster ??= new BoardBroadcaster());
