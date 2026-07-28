// The icons a team owner can pick as their team crest. Deliberately a fixed
// allowlist rather than a free-text slug field: the value is rendered on
// other people's profiles, so it has to be something we chose.
import { CLASS_ICON, MISC_ICON, SPELL_ICON } from "./icons";
import { CLASSES } from "./classes";

export const TEAM_ICONS: { slug: string; name: string }[] = [
  { slug: MISC_ICON.keystone, name: "Keystone" },
  { slug: MISC_ICON.roster, name: "Roster" },
  { slug: SPELL_ICON.lust, name: "Bloodlust" },
  { slug: SPELL_ICON.combatRes, name: "Battle Res" },
  { slug: MISC_ICON.clock, name: "Schedule" },
  { slug: MISC_ICON.parse, name: "Parses" },
  ...CLASSES.map((c) => ({ slug: CLASS_ICON[c.id], name: c.name })),
];

/** Every team currently gets this one - the picker above is written and
 * validated end to end, it just isn't exposed in the create form yet. */
export const DEFAULT_TEAM_ICON = MISC_ICON.roster;

const ALLOWED = new Set(TEAM_ICONS.map((i) => i.slug));

export function isTeamIconSlug(value: unknown): value is string {
  return typeof value === "string" && ALLOWED.has(value);
}
