// A team is a fixed Mythic+ party: 1 tank, 1 healer, 3 dps. Open slots are
// never chosen freely - they're whatever the party still needs once the
// current roster is subtracted.
import type { Role } from "./classes";

export const PARTY_COMPOSITION: Record<Role, number> = { TANK: 1, HEALER: 1, DPS: 3 };
export const PARTY_SIZE = 5;

const ROLE_ORDER: Role[] = ["TANK", "HEALER", "DPS"];

/**
 * The roles a team is still recruiting, given the roles already on the
 * roster (the leader plus any accepted members). Tank first, then healer,
 * then dps - the order the slot pickers render in.
 *
 * Over-filled roles simply contribute nothing; the count never goes negative.
 */
export function openRoleSlots(takenRoles: string[]): Role[] {
  const need = { ...PARTY_COMPOSITION };
  for (const role of takenRoles) {
    if (role in need) need[role as Role] -= 1;
  }
  return ROLE_ORDER.flatMap((role) => Array.from({ length: Math.max(0, need[role]) }, () => role));
}

/**
 * Recomputes a team's open slots from who is actually on the roster, keeping
 * each role's existing spec preferences.
 *
 * Accepting someone trims a slot; without this, a member leaving would never
 * give that spot back and the team would sit at zero openings forever - which
 * now also means permanently unlisted (see teamStatusForSlots).
 */
export function rebuildOpenSlots(
  memberRoles: string[],
  existingSlots: { role: string; prefs: string[] }[]
): { role: Role; prefs: string[] }[] {
  const prefsByRole = new Map<string, string[]>();
  for (const s of existingSlots) {
    if (!prefsByRole.has(s.role)) prefsByRole.set(s.role, s.prefs);
  }
  return openRoleSlots(memberRoles).map((role) => ({ role, prefs: prefsByRole.get(role) ?? [] }));
}

/**
 * A team with every spot filled stops being a listing - it drops off the
 * board on its own rather than sitting there advertising nothing. It stays a
 * real team: members keep their membership and it still shows on their
 * profiles, unlike "delisted", which is the owner tearing the team down.
 */
export function teamStatusForSlots(slots: unknown[]): "open" | "full" {
  return slots.length === 0 ? "full" : "open";
}
