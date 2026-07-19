import { boardBroadcaster } from "@/server/board/broadcaster";

export const dynamic = "force-dynamic";

// SSE: pushes the full board every few seconds so clients stay live without
// polling. The interval, board query, and Solo Queue match pass are shared
// across all connections - see src/server/board/broadcaster.ts; this route
// only bridges the broadcaster to one client's ReadableStream.
export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = boardBroadcaster.subscribe((chunk) => {
        controller.enqueue(encoder.encode(chunk));
      });
    },
    cancel() {
      unsubscribe?.();
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
