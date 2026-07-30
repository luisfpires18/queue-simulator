// Rotation rule-pack registry. One pack per spec, keyed by SpecDef.id from
// src/game/classes.ts. Specs with no pack return null and the /improvement page
// simply omits the rotation-review section for them - the rest of the report is
// unaffected, so packs can land one spec at a time.
import { DEATHKNIGHT_UNHOLY } from "./deathknight-unholy";
import type { RotationSpec } from "./types";

export type { RotationSpec, RotationRule, RotationSource, RotationBuild } from "./types";

const PACKS: RotationSpec[] = [DEATHKNIGHT_UNHOLY];

const BY_SPEC_ID = new Map(PACKS.map((p) => [p.specId, p]));

export function rotationSpecFor(specId: string | null | undefined): RotationSpec | null {
  if (!specId) return null;
  return BY_SPEC_ID.get(specId) ?? null;
}

/**
 * WCL reports class and spec as its own PascalCase strings ("DeathKnight",
 * "Unholy"); SpecDef ids are lowercase and colon-joined. This is the only bridge
 * between the two, kept next to the packs so a new pack's id is obviously right.
 */
export function specIdFromWcl(className: string | null, specName: string | null): string | null {
  if (!className || !specName) return null;
  return `${className.toLowerCase().replace(/[^a-z]/g, "")}:${specName.toLowerCase().replace(/[^a-z]/g, "")}`;
}

/** Every spec that currently has a pack - for docs and the refresh script. */
export function packedSpecIds(): string[] {
  return PACKS.map((p) => p.specId);
}
