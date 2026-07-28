// Shared count-shaping helpers. Pure and Prisma-free, so both the
// application modules and declineRecords can use them without importing each
// other - they already reference each other in the other direction.

/**
 * Turns a Prisma `groupBy` result into a complete map over the ids that were
 * asked about.
 *
 * groupBy omits ids with no matching rows, but the UI needs a real 0 there:
 * `undefined` reads as "still loading" and leaves a badge hidden forever.
 * Ids outside `ids` are dropped, which is what keeps owner-only counts from
 * leaking through a stray row.
 */
export function mergeCounts(ids: string[], rows: { id: string; count: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = 0;
  for (const r of rows) if (r.id in out) out[r.id] = r.count;
  return out;
}
