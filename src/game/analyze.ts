// Pure comp-analysis engine. No I/O, no framework. Fully unit-tested.
// Powers board cards, the group builder, and profile fit-checks.

import { specById, type Role, type SpecDef } from "./classes";
import { BLOODLUST, COMBAT_RES, type UtilityDef } from "./utilities";
import { ratingTier, type RatingTier } from "./season";
import { ARCHETYPES, OFF_META } from "./comps";

export interface Member {
  specId: string;
  name?: string;
  rating?: number;
  ilvl?: number;
}

export interface UtilityCoverage {
  id: string;
  short: string;
  icon: string;
  covered: boolean;
  providers: { name?: string; ability: string }[]; // who in the group provides it
}

export interface ArchetypeMatch {
  id: string;
  label: string;
  blurb: string;
  confidence: number; // 0-100
}

export type NeedKind = "role" | "utility" | "archetype";
export interface Need {
  kind: NeedKind;
  severity: "critical" | "recommended";
  text: string;
}

export interface Analysis {
  size: number;
  roles: { tank: number; healer: number; dps: number };
  rolesOk: boolean;
  utilities: UtilityCoverage[];
  lust: boolean;
  combatRes: boolean;
  archetype: ArchetypeMatch;
  needs: Need[];
  avgRating: number;
  minRating: number;
  ratingTier: RatingTier;
  complete: boolean; // 1/1/3 + all mandatory utilities
}

const GROUP_TARGET = { tank: 1, healer: 1, dps: 3 };

function coverageFor(util: UtilityDef, specs: SpecDef[], members: Member[]): UtilityCoverage {
  const providers: { name?: string; ability: string }[] = [];
  specs.forEach((sp, i) => {
    const ability = util.providers[sp.classId];
    if (ability) providers.push({ name: members[i]?.name, ability });
  });
  return {
    id: util.id,
    short: util.short,
    icon: util.icon,
    covered: providers.length > 0,
    providers,
  };
}

function matchArchetype(specIds: string[]): ArchetypeMatch {
  let best = { id: OFF_META.id, label: OFF_META.label, blurb: OFF_META.blurb, confidence: 0 };
  const present = new Set(specIds);

  for (const arch of ARCHETYPES) {
    const total = arch.signature.reduce((a, s) => a + s.weight, 0);
    const hit = arch.signature.reduce(
      (a, s) => a + (present.has(s.specId) ? s.weight : 0),
      0
    );
    const confidence = total > 0 ? Math.round((hit / total) * 100) : 0;
    if (confidence > best.confidence) {
      best = { id: arch.id, label: arch.label, blurb: arch.blurb, confidence };
    }
  }
  // Below a floor it's just an off-meta group.
  if (best.confidence < 40) {
    return { id: OFF_META.id, label: OFF_META.label, blurb: OFF_META.blurb, confidence: best.confidence };
  }
  return best;
}

export function analyzeGroup(members: Member[]): Analysis {
  const specs = members
    .map((m) => specById(m.specId))
    .filter((x): x is SpecDef => Boolean(x));
  const specIds = specs.map((s) => s.id);

  // roles
  const roles = { tank: 0, healer: 0, dps: 0 };
  for (const sp of specs) {
    if (sp.role === "TANK") roles.tank++;
    else if (sp.role === "HEALER") roles.healer++;
    else roles.dps++;
  }
  const rolesOk =
    roles.tank === GROUP_TARGET.tank &&
    roles.healer === GROUP_TARGET.healer &&
    roles.dps === GROUP_TARGET.dps;

  // utilities
  const lustCov = coverageFor(BLOODLUST, specs, members);
  const resCov = coverageFor(COMBAT_RES, specs, members);
  const utilities = [lustCov, resCov];

  // ratings
  const ratings = members.map((m) => m.rating ?? 0);
  const avgRating = ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
  const minRating = ratings.length ? Math.min(...ratings) : 0;

  // archetype
  const archetype = matchArchetype(specIds);

  // needs (ranked: critical first)
  const needs: Need[] = [];
  const missingRole = (r: Role, have: number, want: number, label: string) => {
    if (have < want) needs.push({ kind: "role", severity: "critical", text: `Needs ${want - have} ${label}` });
    if (have > want) needs.push({ kind: "role", severity: "recommended", text: `${have - want} extra ${label}` });
  };
  const filled = members.filter((m) => specById(m.specId)).length;
  if (filled < 5) {
    missingRole("TANK", roles.tank, GROUP_TARGET.tank, "tank");
    missingRole("HEALER", roles.healer, GROUP_TARGET.healer, "healer");
    if (roles.dps < GROUP_TARGET.dps)
      needs.push({ kind: "role", severity: "critical", text: `Needs ${GROUP_TARGET.dps - roles.dps} DPS` });
  } else {
    // full group but wrong role balance
    if (!rolesOk) {
      if (roles.tank !== 1) needs.push({ kind: "role", severity: "critical", text: roles.tank < 1 ? "Needs a tank" : "Too many tanks" });
      if (roles.healer !== 1) needs.push({ kind: "role", severity: "critical", text: roles.healer < 1 ? "Needs a healer" : "Too many healers" });
    }
  }
  if (!lustCov.covered)
    needs.push({ kind: "utility", severity: "critical", text: "Needs Bloodlust (Shaman / Mage / Hunter / Evoker)" });
  if (!resCov.covered)
    needs.push({ kind: "utility", severity: "critical", text: "Needs Battle Res (Druid / DK / Warlock / Paladin)" });

  // archetype nudge: if close to Meta but missing signature pieces
  if (archetype.id === "meta" && archetype.confidence < 100 && filled < 5) {
    const present = new Set(specIds);
    const missing = ARCHETYPES.find((a) => a.id === "meta")!.signature.filter((s) => !present.has(s.specId));
    if (missing.length) {
      const label = specById(missing[0].specId)?.name ?? missing[0].specId;
      needs.push({ kind: "archetype", severity: "recommended", text: `Add ${label} to complete Meta comp` });
    }
  }

  const complete = rolesOk && lustCov.covered && resCov.covered;

  return {
    size: filled,
    roles,
    rolesOk,
    utilities,
    lust: lustCov.covered,
    combatRes: resCov.covered,
    archetype,
    needs,
    avgRating,
    minRating,
    ratingTier: ratingTier(avgRating),
    complete,
  };
}
