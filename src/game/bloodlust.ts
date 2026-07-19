// Bloodlust/Heroism availability - pure game knowledge, shared by both
// boards' "Bloodlust fit check" filter.
import type { ClassId, Role } from "./classes";

/** Classes that bring a Bloodlust/Heroism-equivalent; none of these are tanks. */
export const BLOODLUST_CLASSES: ClassId[] = ["hunter", "shaman", "mage", "evoker"];

/** Roles whose open slots could still be filled by a Bloodlust class. */
export const BLOODLUST_ROLES = new Set<Role>(["DPS", "HEALER"]);

/** True when the group already has Lust, or still has an open DPS/Healer
 * slot a Lust class could fill. */
export function bloodlustFits(group: {
  members: { classId: string }[];
  slots: { role: string }[];
}): boolean {
  const hasBL = group.members.some((m) => BLOODLUST_CLASSES.includes(m.classId as ClassId));
  const hasOpenBLSlot = group.slots.some((s) => BLOODLUST_ROLES.has(s.role as Role));
  return hasBL || hasOpenBLSlot;
}
