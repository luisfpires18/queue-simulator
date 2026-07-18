import { listGroups } from "@/data/source";

export const dynamic = "force-dynamic";

// SSE: pushes the full board every few seconds so clients stay live without polling.
export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        try {
          const groups = await listGroups();
          controller.enqueue(encoder.encode(`event: board\ndata: ${JSON.stringify({ groups, ts: Date.now() })}\n\n`));
        } catch {
          // next tick retries
        }
      };
      await send();
      const interval = setInterval(send, 4000);
      const ping = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);
      // @ts-ignore store for cancel
      controller._cleanup = () => { closed = true; clearInterval(interval); clearInterval(ping); };
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
