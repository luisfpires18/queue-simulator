// Feature gating. Pure - no I/O, no Prisma, no auth imports - so the access
// decision can be unit-tested exhaustively and reasoned about on its own.
//
// The rule that matters most: this ONLY ever decides whether a feature is
// visible. It has no say over who is an admin - that stays in
// src/game/adminAllowlist.ts, reading an environment variable, so there is no
// path from "can edit feature flags" to "can make myself an admin".

export type Visibility = "admin" | "allowlist" | "public";

export const VISIBILITY_OPTIONS = [
  {
    value: "admin",
    label: "Admin only",
    hint: "Only accounts in ADMIN_BNET_IDS. Use while a feature is unfinished.",
  },
  {
    value: "allowlist",
    label: "Invite only",
    hint: "Admins, plus the Battle.net accounts you grant below.",
  },
  { value: "public", label: "Everyone", hint: "Live for all signed-in users." },
] as const satisfies readonly { value: Visibility; label: string; hint: string }[];

export const VISIBILITY_LABEL: Record<Visibility, string> = Object.fromEntries(
  VISIBILITY_OPTIONS.map((o) => [o.value, o.label])
) as Record<Visibility, string>;

export type FeatureKey = "recruitment" | "guilds" | "analyses";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  /** Applied when no FeatureFlag row exists. Everything currently gated
   * defaults to "admin" so a fresh database, or a failed read, leaves an
   * unfinished area closed rather than publishing it. */
  defaultVisibility: Visibility;
  /** Where the nav entry points, when the feature has one. */
  href: string;
}

/** The registry. Adding an entry here is the only step needed for a feature to
 * appear in the admin dashboard - the flag row is created on first write. */
export const FEATURES: readonly FeatureDef[] = [
  {
    key: "recruitment",
    label: "Recruitment M+",
    description: "Persistent Mythic+ team and player recruitment.",
    defaultVisibility: "admin",
    href: "/recruitment",
  },
  {
    key: "guilds",
    label: "Guilds",
    description: "Raid guild, team, trial and substitute recruitment.",
    defaultVisibility: "admin",
    href: "/guilds",
  },
  {
    key: "analyses",
    label: "Applicant Analyses",
    description: "Warcraft Logs applicant scan. Spends the shared WCL token budget.",
    defaultVisibility: "admin",
    href: "/analyses",
  },
];

export const FEATURE_BY_KEY: Record<string, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f])
);

export function isFeatureKey(key: string): key is FeatureKey {
  return key in FEATURE_BY_KEY;
}

const VISIBILITIES: readonly string[] = VISIBILITY_OPTIONS.map((o) => o.value);

export function isVisibility(v: string): v is Visibility {
  return VISIBILITIES.includes(v);
}

/** The stored visibility for a feature, or its default when there is no row -
 * and equally when the stored value is not one we recognise.
 *
 * Both fallbacks go to the DEFAULT, never to "public": a missing row, a typo
 * written straight into the database, or a value from a newer schema must all
 * leave an unfinished feature closed. */
export function resolveVisibility(key: string, stored: string | null | undefined): Visibility {
  if (stored && isVisibility(stored)) return stored;
  return FEATURE_BY_KEY[key]?.defaultVisibility ?? "admin";
}

/** The whole access decision.
 *
 * An admin passes at every level - they are the ones who set the flag, and
 * locking yourself out of your own alpha would be absurd. */
export function canAccessFeature(input: {
  visibility: Visibility;
  isAdmin: boolean;
  isGranted: boolean;
}): boolean {
  if (input.isAdmin) return true;
  switch (input.visibility) {
    case "public":
      return true;
    case "allowlist":
      return input.isGranted;
    case "admin":
      return false;
    default:
      // Unreachable while Visibility is exhaustive, but an unknown value must
      // deny rather than fall through to allow.
      return false;
  }
}

/** Whether a grant is worth anything at this visibility - drives the dashboard
 * hint explaining that grants are ignored at "admin" and redundant at
 * "public". */
export function grantsApply(visibility: Visibility): boolean {
  return visibility === "allowlist";
}
