// Three-way coverage: HAVE (actual players in the group), WANT (covered only by
// the desired/preferred specs of open slots — not yet secured), MISSING (neither).
import { specById, CLASS_BY_ID, type ClassId } from "./classes";
import { UTILITIES, classProvides } from "./utilities";
import { BUFFS } from "./buffs";
import { DEFENSIVES } from "./defensives";
import { EXTERNAL_DEFENSIVES } from "./externalDefensives";
import { DISPELS } from "./dispels";
import { ENEMY_DISPELS } from "./enemyDispels";
import { SKIPS } from "./skips";
import { MOVEMENT } from "./movement";
import { WARLOCK_UTILITY } from "./warlockUtility";
import { ENEMY_REPOSITIONING } from "./enemyRepositioning";

export type CoverageStatus = "have" | "want" | "missing";

export interface CoverageItem {
  id: string;
  label: string;
  description?: string; // full tooltip text
  iconSlug?: string;
  fallbackColor?: string;
  status: CoverageStatus;
  critical: boolean; // lust / res
  requiresTalent?: boolean; // "have" isn't guaranteed — the spec must also have picked this talent
}

// Plain have/want/missing breakdown, no extra fields — used by buffs, party
// defensives and external defensives.
export interface BasicCoverage {
  items: CoverageItem[];
  have: CoverageItem[];
  want: CoverageItem[];
  missing: CoverageItem[];
}

// Utility coverage additionally surfaces Lust/Res status directly, since a
// group missing either gets a dedicated warning banner.
export interface Coverage extends BasicCoverage {
  lust: CoverageStatus;
  res: CoverageStatus;
  warning: boolean; // lust or res fully missing (not even wanted)
}

function classesOf(specIds: (string | null | undefined)[]): Set<ClassId> {
  const set = new Set<ClassId>();
  for (const sid of specIds) {
    const sp = sid ? specById(sid) : null;
    if (sp) set.add(sp.classId);
  }
  return set;
}

function statusFor(
  providers: ClassId[] | ((c: ClassId) => boolean),
  actual: Set<ClassId>,
  desired: Set<ClassId>
): CoverageStatus {
  const test = typeof providers === "function" ? providers : (c: ClassId) => providers.includes(c);
  if ([...actual].some(test)) return "have";
  if ([...desired].some(test)) return "want";
  return "missing";
}

function bucket(items: CoverageItem[]): BasicCoverage {
  return {
    items,
    have: items.filter((i) => i.status === "have"),
    want: items.filter((i) => i.status === "want"),
    missing: items.filter((i) => i.status === "missing"),
  };
}

interface ClassProviderDef {
  id: string;
  short: string;
  icon: string;
  description: string;
  requiresTalent?: boolean;
  providerClasses: ClassId[];
}

// Shared by buffs and enemy dispels — both are class-wide (any spec of that
// class provides it), unlike the spec-locked defs below.
function computeClassCoverage(
  defs: ClassProviderDef[],
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  const actual = classesOf(actualSpecIds);
  const desired = classesOf(desiredSpecIds);

  const items: CoverageItem[] = defs.map((d) => ({
    id: d.id,
    label: d.short,
    description: d.description,
    iconSlug: d.icon,
    fallbackColor: CLASS_BY_ID[d.providerClasses[0]]?.color,
    status: statusFor(d.providerClasses, actual, desired),
    critical: false,
    requiresTalent: d.requiresTalent,
  }));

  return bucket(items);
}

// Party buffs/debuffs.
export function computeBuffCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  return computeClassCoverage(BUFFS, actualSpecIds, desiredSpecIds);
}

// Trash-skip tools (Shroud, Demonic Gateway, Rescue) — class-wide, like buffs.
export function computeSkipCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  return computeClassCoverage(SKIPS, actualSpecIds, desiredSpecIds);
}

// Enemy magic dispels / Purge / Enrage removal — opposite direction from
// dispels.ts (removing something FROM an enemy, not helping an ally).
export function computeEnemyDispelCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  return computeClassCoverage(ENEMY_DISPELS, actualSpecIds, desiredSpecIds);
}

// Lust, Battle Res, and everything else that doesn't warrant its own section:
// freedoms, cast-throughs, ally repositioning (class-wide) plus party
// movement, Warlock utility, and enemy repositioning ("grips" — spec-locked).
export function computeUtilityCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): Coverage {
  const actual = classesOf(actualSpecIds);
  const desired = classesOf(desiredSpecIds);

  const classItems: CoverageItem[] = UTILITIES.map((u) => ({
    id: u.id,
    label: u.short,
    description: u.description,
    iconSlug: u.icon,
    status: statusFor((c) => classProvides(u, c), actual, desired),
    critical: u.mandatory,
    requiresTalent: u.requiresTalent,
  }));

  const specActual = specIdsOf(actualSpecIds);
  const specDesired = specIdsOf(desiredSpecIds);
  const specItems: CoverageItem[] = [...MOVEMENT, ...WARLOCK_UTILITY, ...ENEMY_REPOSITIONING].map((d) => ({
    id: d.id,
    label: d.short,
    description: d.description,
    iconSlug: d.icon,
    status: specStatusFor(d.providerSpecs, specActual, specDesired),
    critical: false,
    requiresTalent: d.requiresTalent,
  }));

  const items = [...classItems, ...specItems];
  const lust = items.find((i) => i.id === "lust")!.status;
  const res = items.find((i) => i.id === "combatRes")!.status;

  return {
    ...bucket(items),
    lust,
    res,
    warning: lust === "missing" || res === "missing",
  };
}

interface SpecProviderDef {
  id: string;
  short: string;
  icon: string;
  description: string;
  requiresTalent?: boolean;
  providerSpecs: string[];
}

function specIdsOf(specIds: (string | null | undefined)[]): Set<string> {
  return new Set(specIds.filter((s): s is string => !!s));
}

function specStatusFor(providerSpecs: string[], actual: Set<string>, desired: Set<string>): CoverageStatus {
  if ([...actual].some((s) => providerSpecs.includes(s))) return "have";
  if ([...desired].some((s) => providerSpecs.includes(s))) return "want";
  return "missing";
}

// Shared by party defensives, external defensives, dispels, movement, warlock
// utility and enemy repositioning — all spec-locked (e.g. Darkness needs a
// specific DH spec, Detox behaves differently per Monk spec), so this matches
// on exact specId rather than ClassId like the two functions above.
function computeSpecCoverage(
  defs: SpecProviderDef[],
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  const actual = specIdsOf(actualSpecIds);
  const desired = specIdsOf(desiredSpecIds);

  const items: CoverageItem[] = defs.map((d) => ({
    id: d.id,
    label: d.short,
    description: d.description,
    iconSlug: d.icon,
    status: specStatusFor(d.providerSpecs, actual, desired),
    critical: false,
    requiresTalent: d.requiresTalent,
  }));

  return bucket(items);
}

export function computeDefensiveCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  return computeSpecCoverage(DEFENSIVES, actualSpecIds, desiredSpecIds);
}

export function computeExternalDefensiveCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  return computeSpecCoverage(EXTERNAL_DEFENSIVES, actualSpecIds, desiredSpecIds);
}

export function computeDispelCoverage(
  actualSpecIds: (string | null | undefined)[],
  desiredSpecIds: (string | null | undefined)[]
): BasicCoverage {
  return computeSpecCoverage(DISPELS, actualSpecIds, desiredSpecIds);
}
