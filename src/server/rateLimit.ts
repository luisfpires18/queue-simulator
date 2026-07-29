// Lightweight in-memory rate limiter - fine for this app's single-instance
// deployment (SQLite, no Redis/shared cache). globalThis-stashed singleton,
// same idiom as prisma.ts/expirySweeper.ts, so Next dev HMR can't reset
// counters mid-session or spawn parallel instances.
interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };
const buckets = (g.__rateLimitBuckets ??= new Map<string, Bucket>());

// Occasional sweep so long-idle keys don't sit in memory forever - not on
// every check, a fixed interval is cheap and simple.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

/**
 * Fixed-window limiter: at most `limit` calls per `windowMs` for one
 * `${bucket}:${key}` identity. Returns true (and records the hit) if the
 * caller is still under the limit, false if they should be rejected.
 */
export function checkRateLimit(bucket: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweepExpired(now);

  const id = `${bucket}:${key}`;
  const existing = buckets.get(id);
  if (!existing || existing.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count++;
  return true;
}
