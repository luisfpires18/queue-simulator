// Next.js's official server-boot hook (stable since Next 15, no config flag
// needed) — the right place to start in-process background work that should
// run once per server start regardless of traffic, unlike
// src/server/board/broadcaster.ts's SSE-subscriber-gated tick.
export async function register() {
  // register() also fires for the edge runtime bundle; the sweeper uses
  // Prisma/setInterval, both node-only, so it must be guarded out of that.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { expirySweeper } = await import("@/server/groups/expirySweeper");
    expirySweeper.start();

    const { seasonSnapshotter } = await import("@/server/season/snapshotter");
    seasonSnapshotter.start();
  }
}
