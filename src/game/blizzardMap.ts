// Map Blizzard API class/spec display names -> our internal ids.
import { CLASSES, ALL_SPECS, type ClassId } from "./classes";

const CLASS_BY_NAME: Record<string, ClassId> = Object.fromEntries(
  CLASSES.map((c) => [c.name.toLowerCase(), c.id])
);

export function classIdFromName(name?: string): ClassId | null {
  if (!name) return null;
  return CLASS_BY_NAME[name.toLowerCase()] ?? null;
}

// spec name is unique within a class (e.g. "Restoration" appears in Druid & Shaman)
export function specIdFromNames(className?: string, specName?: string): string | null {
  const classId = classIdFromName(className);
  if (!classId || !specName) return null;
  const spec = ALL_SPECS.find(
    (s) => s.classId === classId && s.name.toLowerCase() === specName.toLowerCase()
  );
  return spec?.id ?? null;
}

// Real Blizzard spec ids (stable since Mists of Pandaria; new specs get ids
// allocated as they're added — Devourer=1480 confirmed live against the
// Midnight S1 API/leaderboard). Shared by src/data/raiderio.ts and the
// Blizzard leaderboard collector (src/server/collector) — one source of
// truth for the numeric-id side of the class/spec mapping this file already
// owns the name side of.
export const SPEC_ID_TO_SPEC_ID: Record<number, string> = {
  71: "warrior:arms", 72: "warrior:fury", 73: "warrior:protection",
  65: "paladin:holy", 66: "paladin:protection", 70: "paladin:retribution",
  253: "hunter:beastmastery", 254: "hunter:marksmanship", 255: "hunter:survival",
  259: "rogue:assassination", 260: "rogue:outlaw", 261: "rogue:subtlety",
  256: "priest:discipline", 257: "priest:holy", 258: "priest:shadow",
  262: "shaman:elemental", 263: "shaman:enhancement", 264: "shaman:restoration",
  62: "mage:arcane", 63: "mage:fire", 64: "mage:frost",
  265: "warlock:affliction", 266: "warlock:demonology", 267: "warlock:destruction",
  268: "monk:brewmaster", 269: "monk:windwalker", 270: "monk:mistweaver",
  102: "druid:balance", 103: "druid:feral", 104: "druid:guardian", 105: "druid:restoration",
  577: "demonhunter:havoc", 581: "demonhunter:vengeance", 1480: "demonhunter:devourer",
  250: "deathknight:blood", 251: "deathknight:frost", 252: "deathknight:unholy",
  1467: "evoker:devastation", 1468: "evoker:preservation", 1473: "evoker:augmentation",
};
