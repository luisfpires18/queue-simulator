// Entry point: `npm run collect:runs` (or `npx tsx src/server/collector/cli.ts`).
//
// Runs one sweep and exits. Pass `--loop` (or `--loop=<minutes>`, default 60)
// to keep the process alive and re-poll on an interval instead — convenient
// for local/dev use, but for a real deployment prefer registering this
// script with an OS-level scheduler (cron, Task Scheduler, Vercel Cron) and
// running it without --loop, so a crashed process doesn't silently stop
// collection until someone notices.
import { collectRuns } from "./collectRuns";

function parseLoopMinutes(argv: string[]): number | null {
  const arg = argv.find((a) => a.startsWith("--loop"));
  if (!arg) return null;
  const [, value] = arg.split("=");
  const minutes = value ? Number(value) : 60;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
}

async function main() {
  const loopMinutes = parseLoopMinutes(process.argv.slice(2));

  const run = async () => {
    const startedAt = new Date().toISOString();
    console.log(`[collector] sweep starting ${startedAt}`);
    try {
      await collectRuns();
    } catch (err) {
      console.error("[collector] sweep failed:", err instanceof Error ? err.message : err);
    }
  };

  await run();

  if (loopMinutes != null) {
    console.log(`[collector] looping every ${loopMinutes} minute(s) — Ctrl+C to stop`);
    setInterval(run, loopMinutes * 60_000);
  }
}

main();
