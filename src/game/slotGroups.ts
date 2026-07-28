// Open slots are stored one row per opening (three DPS spots are three
// entries), because that count is what drives "is this group full", the
// accept-time slot trim, and the slot squares on a card.
//
// They are *edited* one row per ROLE, though. Three parallel ranked DPS lists
// only ever said "any of these, three times over" - a group that wants a
// specific composition expresses it with `combos` (Desired comps), which says
// "these specs together" and is strictly more precise. So the editor shows
// one picker per role and writes the same prefs to every slot of that role.
import type { Role } from "./classes";

export interface RoleSlotGroup {
  role: Role;
  /** How many openings of this role exist - shown as a xN on the picker. */
  count: number;
  prefs: string[];
}

const ROLE_ORDER: Role[] = ["TANK", "HEALER", "DPS"];

/**
 * Collapses per-slot entries into one group per role, tank/healer/dps order.
 *
 * `prefs` is the deduped union across that role's slots, in first-seen order.
 * Union rather than "the first slot wins" so that a listing created before
 * this collapsed editor - one that really did have different lists per DPS
 * slot - shows every spec its owner picked instead of silently dropping the
 * ones that lived on slots 2 and 3.
 */
export function groupSlotsByRole(slots: { role: string; prefs: string[] }[]): RoleSlotGroup[] {
  const byRole = new Map<Role, RoleSlotGroup>();
  for (const slot of slots) {
    const role = slot.role as Role;
    const existing = byRole.get(role);
    if (existing) {
      existing.count += 1;
      for (const p of slot.prefs) if (!existing.prefs.includes(p)) existing.prefs.push(p);
    } else {
      byRole.set(role, { role, count: 1, prefs: [...new Set(slot.prefs)] });
    }
  }
  return ROLE_ORDER.filter((r) => byRole.has(r)).map((r) => byRole.get(r)!);
}

/**
 * How many of each role a listing can still take, straight from its open
 * slots. This is what bounds the Desired-comps builder: a combo describes the
 * rest of the team, so a tank listing a key offers no tank at all, and a dps
 * listing one offers two more dps rather than three.
 */
export function roleBudgetFromSlots(slots: { role: string }[]): Record<Role, number> {
  const budget: Record<Role, number> = { TANK: 0, HEALER: 0, DPS: 0 };
  for (const s of slots) {
    if (s.role in budget) budget[s.role as Role] += 1;
  }
  return budget;
}

/** The roles a combo can still take: budgeted, minus what it already holds. */
export function rolesStillAvailable(budget: Record<Role, number>, taken: { role: string }[]): Role[] {
  const used = roleBudgetFromSlots(taken);
  return ROLE_ORDER.filter((r) => budget[r] > used[r]);
}

/** Applies one role's prefs to every slot of that role, leaving others alone. */
export function setPrefsForRole<T extends { role: string; prefs: string[] }>(
  slots: T[],
  role: string,
  prefs: string[]
): T[] {
  return slots.map((s) => (s.role === role ? { ...s, prefs } : s));
}
