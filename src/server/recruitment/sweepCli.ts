// Entry point: `npm run sweep:recruitment` (or `npx tsx
// src/server/recruitment/sweepCli.ts`).
//
// Runs one sweep and exits. Register it with an OS-level scheduler (cron,
// Task Scheduler, a platform cron job) rather than looping in-process - a
// crashed long-lived process stops sweeping silently, and nobody notices until
// the board is full of dead listings. Same reasoning as the run collector's
// CLI, which documents the identical trade-off.
//
// Safe to run as often as you like: every update is idempotent and scoped to
// rows that are both past their expiry AND still in a live status, so a second
// run in the same minute changes nothing.
import { sweepExpired } from "./sweep";

async function main() {
  const started = Date.now();
  const result = await sweepExpired();

  const total =
    result.mplusPostsClosed +
    result.raidTeamsClosed +
    result.raiderProfilesClosed +
    result.applicationsExpired;

  console.log(
    `[recruitment sweep] ${total} row(s) in ${Date.now() - started}ms`,
    JSON.stringify(result)
  );
}

main()
  .then(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("[recruitment sweep] failed", err);
    process.exitCode = 1;
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
  });
