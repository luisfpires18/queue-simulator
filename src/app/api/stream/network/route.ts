import { networkBroadcaster } from "@/server/network/broadcaster";
import { listFriendUserIds } from "@/data/network";
import { getSessionUser, notAuthenticated } from "@/server/http";

export const dynamic = "force-dynamic";

/** Tells every friend this user is now online/offline — only on the 0-to-1 /
 * 1-to-0 connection transition, so opening a second tab doesn't spam a
 * duplicate "online" event to friends who already know. */
async function announcePresence(userId: string, online: boolean) {
  const friendIds = await listFriendUserIds(userId);
  for (const friendId of friendIds) networkBroadcaster.publish(friendId, { type: "presence", userId, online });
}

// SSE: pushes friend-request, chat, and presence events to this one user's
// connections as they happen — see src/server/network/broadcaster.ts. Unlike
// /api/stream/board, there's no shared tick to bridge; this just registers
// the caller's own subscriber slot and, on the first/last connection for this
// user, tells their friends they went online/offline.
export async function GET() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const wasOnline = networkBroadcaster.isOnline(ctx.user.id);
      unsubscribe = networkBroadcaster.subscribe(ctx.user.id, (chunk) => {
        controller.enqueue(encoder.encode(chunk));
      });
      if (!wasOnline) announcePresence(ctx.user.id, true).catch((err) => console.error("announcePresence online failed", err));
    },
    cancel() {
      unsubscribe?.();
      if (!networkBroadcaster.isOnline(ctx.user.id)) {
        announcePresence(ctx.user.id, false).catch((err) => console.error("announcePresence offline failed", err));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
