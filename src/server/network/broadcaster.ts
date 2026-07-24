// Per-user fan-out for the Network SSE stream (/api/stream/network). Unlike
// src/server/board/broadcaster.ts (one shared DB-poll tick fanned out to
// everyone), there's no "board" to re-fetch here — friend requests and chat
// messages are discrete events for one specific recipient, so this publishes
// them directly at the moment they happen instead of on a timer.
//
// Stashed on globalThis (same idiom as src/lib/prisma.ts / boardBroadcaster)
// so Next dev HMR can't spawn parallel instances. Per-process by design, same
// caveat as the board broadcaster: correct for `next dev` / single-node
// `next start`, not multi-node (would need a shared pub/sub there too).
const PING_INTERVAL_MS = 15000;

export type NetworkEvent =
  | { type: "friend_request"; requestId: string }
  | { type: "friend_resolved"; requestId: string; status: "accepted" | "declined" | "cancelled" }
  | { type: "friend_removed"; userId: string }
  | { type: "message"; senderId: string; recipientId: string }
  | { type: "presence"; userId: string; online: boolean }
  | { type: "chat_group_message"; chatGroupId: string; senderId: string }
  | { type: "chat_group_updated"; chatGroupId: string };

type Subscriber = (chunk: string) => void;

class NetworkBroadcaster {
  private subs = new Map<string, Set<Subscriber>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /** Registers one connection for a user. Returns the unsubscribe function. */
  subscribe(userId: string, send: Subscriber): () => void {
    let set = this.subs.get(userId);
    if (!set) {
      set = new Set();
      this.subs.set(userId, set);
    }
    set.add(send);
    this.startPingIfNeeded();
    return () => {
      set?.delete(send);
      if (set && set.size === 0) this.subs.delete(userId);
      if (this.subs.size === 0) this.stopPing();
    };
  }

  /** True if this user has at least one open Network SSE connection right
   * now — the presence signal behind the friends list' online dot. */
  isOnline(userId: string): boolean {
    return (this.subs.get(userId)?.size ?? 0) > 0;
  }

  /** Pushes an event to every open connection for one user (no-op if they
   * have none open). */
  publish(userId: string, event: NetworkEvent): void {
    const set = this.subs.get(userId);
    if (!set || set.size === 0) return;
    const chunk = `event: network\ndata: ${JSON.stringify(event)}\n\n`;
    for (const send of set) {
      try {
        send(chunk);
      } catch {
        // A client torn down mid-publish just misses this event; its
        // route-level cancel() unsubscribes it.
      }
    }
  }

  private startPingIfNeeded() {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      for (const set of this.subs.values()) {
        for (const send of set) {
          try {
            send(`: ping\n\n`);
          } catch {
            // ignore, same as publish
          }
        }
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}

const g = globalThis as unknown as { __networkBroadcaster?: NetworkBroadcaster };
export const networkBroadcaster = (g.__networkBroadcaster ??= new NetworkBroadcaster());
