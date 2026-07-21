// Listing expiry and staleness. Pure functions, no I/O.
//
// Recruitment posts outlive a session, so without expiry a browse page fills
// with teams that disbanded three months ago. The rule is: every post carries
// an expiresAt, only the owner can push it forward (a "refresh"), and a post
// goes visibly stale before it disappears so the owner gets a chance to act.

/** M+ teams re-form constantly, so their posts rot fastest. */
export const M_PLUS_TTL_DAYS = 14;
/** Guild rosters move far slower - a 14-day expiry would have officers
 * refreshing a listing that never actually changed. */
export const GUILD_TTL_DAYS = 30;

/** How long before expiry a post starts showing as stale. Deliberately a
 * fraction of the TTL rather than a fixed number of days, so both listing
 * kinds get the same proportional warning. */
const STALE_FRACTION = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ListingKind = "mplus" | "guild";

export function ttlDays(kind: ListingKind): number {
  return kind === "guild" ? GUILD_TTL_DAYS : M_PLUS_TTL_DAYS;
}

/** The expiry stamp for a post refreshed (or created) at `from`. */
export function computeExpiry(from: Date, kind: ListingKind): Date {
  return new Date(from.getTime() + ttlDays(kind) * DAY_MS);
}

export interface ExpirableListing {
  refreshedAt: string | Date;
  expiresAt: string | Date;
}

function ms(v: string | Date): number {
  return v instanceof Date ? v.getTime() : Date.parse(v);
}

export function isExpired(listing: ExpirableListing, now: Date = new Date()): boolean {
  return ms(listing.expiresAt) <= now.getTime();
}

/** Past the halfway point of its life but not yet dead - shown with a "needs a
 * refresh" hint rather than being hidden. */
export function isStale(listing: ExpirableListing, kind: ListingKind, now: Date = new Date()): boolean {
  if (isExpired(listing, now)) return false; // expired is its own state, not a worse stale
  const age = now.getTime() - ms(listing.refreshedAt);
  return age >= ttlDays(kind) * DAY_MS * STALE_FRACTION;
}

export function daysUntilExpiry(listing: ExpirableListing, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((ms(listing.expiresAt) - now.getTime()) / DAY_MS));
}

/** "Expires in 3 days" / "Expired" - the card footer string. */
export function formatExpiry(listing: ExpirableListing, now: Date = new Date()): string {
  if (isExpired(listing, now)) return "Expired";
  const days = daysUntilExpiry(listing, now);
  if (days <= 1) return "Expires today";
  return `Expires in ${days} days`;
}

/** "3 days ago" style age of a listing, for the "listing age" the cards show. */
export function formatListingAge(createdAt: string | Date, now: Date = new Date()): string {
  const diff = now.getTime() - ms(createdAt);
  const days = Math.floor(diff / DAY_MS);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return "Just now";
}

/** Positions filled automatically close their listing once nothing is open.
 * Returns the status the post SHOULD have, so the caller can persist it - kept
 * pure so the rule is testable without a database. */
export function statusAfterPositionChange(
  currentStatus: string,
  positions: readonly { isFilled: boolean }[]
): string {
  // Only ever transitions an actively-recruiting post. A paused or closed post
  // stays where the owner put it.
  if (currentStatus !== "open") return currentStatus;
  if (!positions.length) return currentStatus;
  return positions.every((p) => p.isFilled) ? "filled" : "open";
}
