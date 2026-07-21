// Pure weekly-availability math. No I/O - mirrors scheduling.ts/soloQueue.ts.
//
// A recruitment listing's schedule is a repeating weekly pattern ("Tue/Thu
// 20:00-23:00"), not a set of instants, so none of this can reuse
// scheduling.ts's startsConflict (which compares two absolute DateTimes for
// the live board). Times are minutes-since-midnight rather than "20:00"
// strings so every operation below is integer arithmetic.

export const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** 0 = Sunday, matching JS Date#getDay so callers never have to re-base. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** One "I'm free then" block, local to the owning row's own timeZone.
 * `endMin <= startMin` means the block wraps past midnight (e.g. 22:00-01:00),
 * which is the common case for late-night raid teams. */
export interface WeeklySlot {
  day: number; // 0-6, 0 = Sunday
  startMin: number; // 0-1439
  endMin: number; // 0-1440; <= startMin means it wraps into the next day
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LABELS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** A slot flattened onto the 0..10079 minute week line. A wrapping slot
 * produces an interval whose end exceeds MINUTES_PER_WEEK; overlap() below
 * handles that by also testing the interval shifted back one full week. */
interface WeekInterval {
  start: number;
  end: number;
}

function isValidSlot(s: WeeklySlot): boolean {
  return (
    Number.isInteger(s.day) &&
    s.day >= 0 &&
    s.day <= 6 &&
    Number.isFinite(s.startMin) &&
    Number.isFinite(s.endMin) &&
    s.startMin >= 0 &&
    s.startMin < MINUTES_PER_DAY &&
    s.endMin > 0 &&
    s.endMin <= MINUTES_PER_DAY
  );
}

/** Drops malformed entries and collapses zero-length ones. Everything that
 * reads a persisted `availability` JSON column goes through here first, since
 * those columns are unvalidated at the DB level. */
export function normalizeSlots(slots: WeeklySlot[]): WeeklySlot[] {
  return slots
    .filter(isValidSlot)
    .filter((s) => s.startMin !== s.endMin) // zero-length: nothing to match on
    .map((s) => ({ day: Math.trunc(s.day), startMin: Math.trunc(s.startMin), endMin: Math.trunc(s.endMin) }));
}

function toIntervals(slots: WeeklySlot[]): WeekInterval[] {
  return normalizeSlots(slots).map((s) => {
    const start = s.day * MINUTES_PER_DAY + s.startMin;
    const wraps = s.endMin <= s.startMin;
    const length = wraps ? MINUTES_PER_DAY - s.startMin + s.endMin : s.endMin - s.startMin;
    return { start, end: start + length };
  });
}

function intervalOverlap(a: WeekInterval, b: WeekInterval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Overlap of two intervals on a *circular* week: an interval that runs past
 * Saturday midnight continues into Sunday, so each pair is also compared with
 * one side shifted a week in either direction. */
function circularOverlap(a: WeekInterval, b: WeekInterval): number {
  return Math.max(
    intervalOverlap(a, b),
    intervalOverlap(a, { start: b.start + MINUTES_PER_WEEK, end: b.end + MINUTES_PER_WEEK }),
    intervalOverlap(a, { start: b.start - MINUTES_PER_WEEK, end: b.end - MINUTES_PER_WEEK })
  );
}

/** Total minutes per week that both sides are free at the same time.
 *
 * Both arrays must already be in the SAME frame of reference - callers holding
 * two rows with different timeZones must shiftToUtc() each side first,
 * otherwise this silently compares 20:00 Lisbon against 20:00 Sydney. */
export function overlapMinutes(a: WeeklySlot[], b: WeeklySlot[]): number {
  const ia = toIntervals(a);
  const ib = toIntervals(b);
  let total = 0;
  for (const x of ia) for (const y of ib) total += circularOverlap(x, y);
  return total;
}

/** The days (0-6) on which both sides have any overlap at all. Used for the
 * "available for all three raid nights" style explanation, where the count of
 * shared NIGHTS matters more than the raw minutes. */
export function overlappingDays(a: WeeklySlot[], b: WeeklySlot[]): number[] {
  const days = new Set<number>();
  const ib = toIntervals(b);
  for (const slot of normalizeSlots(a)) {
    const [ia] = toIntervals([slot]);
    if (ia && ib.some((y) => circularOverlap(ia, y) > 0)) days.add(slot.day);
  }
  return [...days].sort((x, y) => x - y);
}

/** Total minutes covered by a slot list, wrapping handled. */
export function totalMinutes(slots: WeeklySlot[]): number {
  return toIntervals(slots).reduce((sum, i) => sum + (i.end - i.start), 0);
}

// ---------------------------------------------------------------------------
// Timezone
// ---------------------------------------------------------------------------

/** Minutes that `timeZone` is ahead of UTC at the instant `at`. Positive east
 * of Greenwich. Uses Intl rather than a date library - Node ships the full
 * ICU tz database, so this is DST-correct for free at the cost of one
 * formatter per call.
 *
 * `at` is explicit (not defaulted internally at the call site) because DST
 * makes the answer date-dependent, and tests need to pin it. */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
  } catch {
    return 0; // unknown/garbage zone: treat as UTC rather than throwing at render time
  }

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Intl renders midnight as hour 24 in some locales/zones; normalize to 0.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Re-expresses slots written in `timeZone` as the equivalent UTC slots, so two
 * listings from different regions can be compared by overlapMinutes.
 *
 * Shifting can push a block across midnight and therefore onto a different
 * day, which is exactly why this returns new slots rather than a scalar
 * offset. A block that ends up straddling midnight is split into two slots so
 * the result stays a plain non-wrapping list where possible. */
export function shiftToUtc(slots: WeeklySlot[], timeZone: string | null | undefined, at: Date): WeeklySlot[] {
  if (!timeZone) return normalizeSlots(slots); // no zone recorded: assume already UTC
  const offset = tzOffsetMinutes(timeZone, at);
  if (offset === 0) return normalizeSlots(slots);

  const out: WeeklySlot[] = [];
  for (const s of normalizeSlots(slots)) {
    const start = s.day * MINUTES_PER_DAY + s.startMin - offset;
    const wraps = s.endMin <= s.startMin;
    const length = wraps ? MINUTES_PER_DAY - s.startMin + s.endMin : s.endMin - s.startMin;
    out.push(...splitToSlots(start, length));
  }
  return out;
}

/** Turns an absolute week-minute range into day-bounded WeeklySlots, wrapping
 * around the week boundary. */
function splitToSlots(startWeekMin: number, length: number): WeeklySlot[] {
  const out: WeeklySlot[] = [];
  let cursor = ((startWeekMin % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
  let remaining = length;

  while (remaining > 0) {
    const day = Math.floor(cursor / MINUTES_PER_DAY) % 7;
    const startMin = cursor % MINUTES_PER_DAY;
    const chunk = Math.min(remaining, MINUTES_PER_DAY - startMin);
    out.push({ day, startMin, endMin: startMin + chunk });
    cursor = (cursor + chunk) % MINUTES_PER_WEEK;
    remaining -= chunk;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatMinutes(min: number): string {
  const m = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Card-sized summary, e.g. "Tue, Thu 20:00-23:00" when every slot shares a
 * time, else "Tue 20:00-23:00, Sat 14:00-18:00". Returns "" for no slots so
 * callers can fall back to their own empty state. */
export function formatSlots(slots: WeeklySlot[]): string {
  const norm = normalizeSlots(slots).sort((a, b) => a.day - b.day || a.startMin - b.startMin);
  if (!norm.length) return "";

  const sameTime = norm.every((s) => s.startMin === norm[0].startMin && s.endMin === norm[0].endMin);
  if (sameTime) {
    const days = [...new Set(norm.map((s) => s.day))].map((d) => DAY_LABELS[d]).join(", ");
    return `${days} ${formatMinutes(norm[0].startMin)}-${formatMinutes(norm[0].endMin)}`;
  }
  return norm
    .map((s) => `${DAY_LABELS[s.day]} ${formatMinutes(s.startMin)}-${formatMinutes(s.endMin)}`)
    .join(", ");
}

/** "6h/week" style total, for cards that need density rather than the days. */
export function formatWeeklyLoad(slots: WeeklySlot[]): string {
  const total = totalMinutes(slots);
  if (!total) return "";
  const hours = total / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h/week`;
}
