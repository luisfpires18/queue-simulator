// Single source of truth for WoW classes & specs (Midnight / patch 12.0.x).
// Meta/season data lives in season.ts & comps.ts so those edits are config, not code.

export type Role = "TANK" | "HEALER" | "DPS";
export type DamageType = "physical" | "magic" | "hybrid";

export type ClassId =
  | "warrior"
  | "paladin"
  | "hunter"
  | "rogue"
  | "priest"
  | "shaman"
  | "mage"
  | "warlock"
  | "monk"
  | "druid"
  | "demonhunter"
  | "deathknight"
  | "evoker";

export interface SpecDef {
  id: string; // unique: `${classId}:${specSlug}`
  classId: ClassId;
  name: string;
  role: Role;
  damage: DamageType;
  heroTalent?: string; // flavor: current-expansion hero talent tree
}

export interface ClassDef {
  id: ClassId;
  name: string;
  color: string; // official class color (hex)
  glyph: string; // short label rendered in the spec badge
  specs: SpecDef[];
}

const s = (
  classId: ClassId,
  slug: string,
  name: string,
  role: Role,
  damage: DamageType,
  heroTalent?: string
): SpecDef => ({ id: `${classId}:${slug}`, classId, name, role, damage, heroTalent });

export const CLASSES: ClassDef[] = [
  {
    id: "warrior",
    name: "Warrior",
    color: "#C69B6D",
    glyph: "WAR",
    specs: [
      s("warrior", "arms", "Arms", "DPS", "physical", "Colossus"),
      s("warrior", "fury", "Fury", "DPS", "physical", "Slayer"),
      s("warrior", "protection", "Protection", "TANK", "physical", "Mountain Thane"),
    ],
  },
  {
    id: "paladin",
    name: "Paladin",
    color: "#F48CBA",
    glyph: "PAL",
    specs: [
      s("paladin", "holy", "Holy", "HEALER", "magic", "Herald of the Sun"),
      s("paladin", "protection", "Protection", "TANK", "hybrid", "Lightsmith"),
      s("paladin", "retribution", "Retribution", "DPS", "hybrid", "Templar"),
    ],
  },
  {
    id: "hunter",
    name: "Hunter",
    color: "#AAD372",
    glyph: "HUN",
    specs: [
      s("hunter", "beastmastery", "Beast Mastery", "DPS", "physical", "Pack Leader"),
      s("hunter", "marksmanship", "Marksmanship", "DPS", "physical", "Sentinel"),
      s("hunter", "survival", "Survival", "DPS", "physical", "Pack Leader"),
    ],
  },
  {
    id: "rogue",
    name: "Rogue",
    color: "#FFF468",
    glyph: "ROG",
    specs: [
      s("rogue", "assassination", "Assassination", "DPS", "physical", "Deathstalker"),
      s("rogue", "outlaw", "Outlaw", "DPS", "physical", "Fatebound"),
      s("rogue", "subtlety", "Subtlety", "DPS", "physical", "Trickster"),
    ],
  },
  {
    id: "priest",
    name: "Priest",
    color: "#FFFFFF",
    glyph: "PRI",
    specs: [
      s("priest", "discipline", "Discipline", "HEALER", "magic", "Voidweaver"),
      s("priest", "holy", "Holy", "HEALER", "magic", "Archon"),
      s("priest", "shadow", "Shadow", "DPS", "magic", "Voidweaver"),
    ],
  },
  {
    id: "shaman",
    name: "Shaman",
    color: "#0070DE",
    glyph: "SHA",
    specs: [
      s("shaman", "elemental", "Elemental", "DPS", "magic", "Stormbringer"),
      s("shaman", "enhancement", "Enhancement", "DPS", "physical", "Stormbringer"),
      s("shaman", "restoration", "Restoration", "HEALER", "magic", "Farseer"),
    ],
  },
  {
    id: "mage",
    name: "Mage",
    color: "#3FC7EB",
    glyph: "MAG",
    specs: [
      s("mage", "arcane", "Arcane", "DPS", "magic", "Spellslinger"),
      s("mage", "fire", "Fire", "DPS", "magic", "Sunfury"),
      s("mage", "frost", "Frost", "DPS", "magic", "Frostfire"),
    ],
  },
  {
    id: "warlock",
    name: "Warlock",
    color: "#8788EE",
    glyph: "LOK",
    specs: [
      s("warlock", "affliction", "Affliction", "DPS", "magic", "Hellcaller"),
      s("warlock", "demonology", "Demonology", "DPS", "magic", "Diabolist"),
      s("warlock", "destruction", "Destruction", "DPS", "magic", "Hellcaller"),
    ],
  },
  {
    id: "monk",
    name: "Monk",
    color: "#00FF98",
    glyph: "MNK",
    specs: [
      s("monk", "brewmaster", "Brewmaster", "TANK", "physical", "Master of Harmony"),
      s("monk", "mistweaver", "Mistweaver", "HEALER", "magic", "Conduit of the Celestials"),
      s("monk", "windwalker", "Windwalker", "DPS", "physical", "Shado-Pan"),
    ],
  },
  {
    id: "druid",
    name: "Druid",
    color: "#FF7C0A",
    glyph: "DRU",
    specs: [
      s("druid", "balance", "Balance", "DPS", "magic", "Keeper of the Grove"),
      s("druid", "feral", "Feral", "DPS", "physical", "Druid of the Claw"),
      s("druid", "guardian", "Guardian", "TANK", "physical", "Druid of the Claw"),
      s("druid", "restoration", "Restoration", "HEALER", "magic", "Wildstalker"),
    ],
  },
  {
    id: "demonhunter",
    name: "Demon Hunter",
    color: "#A330C9",
    glyph: "DH",
    specs: [
      s("demonhunter", "havoc", "Havoc", "DPS", "hybrid", "Aldrachi Reaver"),
      // New 3rd DH spec introduced in Midnight — fel/magic DPS, S1 meta.
      s("demonhunter", "devourer", "Devourer", "DPS", "magic", "Annihilator"),
      s("demonhunter", "vengeance", "Vengeance", "TANK", "hybrid", "Fel-scarred"),
    ],
  },
  {
    id: "deathknight",
    name: "Death Knight",
    color: "#C41E3A",
    glyph: "DK",
    specs: [
      s("deathknight", "blood", "Blood", "TANK", "physical", "Deathbringer"),
      s("deathknight", "frost", "Frost", "DPS", "physical", "Rider of the Apocalypse"),
      s("deathknight", "unholy", "Unholy", "DPS", "magic", "Rider of the Apocalypse"),
    ],
  },
  {
    id: "evoker",
    name: "Evoker",
    color: "#33937F",
    glyph: "EVO",
    specs: [
      s("evoker", "augmentation", "Augmentation", "DPS", "magic", "Scalecommander"),
      s("evoker", "devastation", "Devastation", "DPS", "magic", "Flameshaper"),
      s("evoker", "preservation", "Preservation", "HEALER", "magic", "Chronowarden"),
    ],
  },
];

// ---- lookups ----
export const CLASS_BY_ID: Record<ClassId, ClassDef> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c])
) as Record<ClassId, ClassDef>;

export const ALL_SPECS: SpecDef[] = CLASSES.flatMap((c) => c.specs);

export const SPEC_BY_ID: Record<string, SpecDef> = Object.fromEntries(
  ALL_SPECS.map((sp) => [sp.id, sp])
);

export function specById(id: string): SpecDef | undefined {
  return SPEC_BY_ID[id];
}

export function classColor(classId: ClassId): string {
  return CLASS_BY_ID[classId]?.color ?? "#888888";
}

// String-safe lookup for DB values (classId stored as string).
export function classById(id: string): ClassDef | undefined {
  return CLASS_BY_ID[id as ClassId];
}

// Ranged vs melee split for DPS specs — used to group the DPS spec-picker UI.
// Distinct from `damage` (physical/magic/hybrid): e.g. Enhancement is
// physical-melee, Elemental is magic-ranged, but Survival is physical
// *melee* despite hunters normally being ranged.
const RANGED_DPS_SPEC_IDS = new Set<string>([
  "hunter:beastmastery", "hunter:marksmanship",
  "priest:shadow",
  "shaman:elemental",
  "mage:arcane", "mage:fire", "mage:frost",
  "warlock:affliction", "warlock:demonology", "warlock:destruction",
  "druid:balance",
  "demonhunter:devourer",
  "evoker:augmentation", "evoker:devastation",
]);

export function isRangedDps(specId: string): boolean {
  return RANGED_DPS_SPEC_IDS.has(specId);
}
