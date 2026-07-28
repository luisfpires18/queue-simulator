// Generated profile banners. There is no banner artwork in this repo and no
// remote art dependency: a banner is a CSS gradient built from the official
// class colour (src/game/classes.ts) plus the class crest as a large faded
// watermark. This is both the default for a fresh account and the fallback
// whenever an uploaded image fails to load, so the profile header is never
// an empty box.
import { CLASSES, type ClassId } from "./classes";
import { CLASS_ICON } from "./icons";

export type BannerType = "class" | "upload";

export interface BannerSpec {
  /** Multi-stop CSS gradient, ready for `style={{ background }}`. */
  background: string;
  /** Class crest slug for the watermark, or null for the neutral banner. */
  watermarkSlug: string | null;
  /** Dominant colour, reused for the hairline separator and glow. */
  color: string;
}

/** Neutral house colours - used when no class is chosen and none can be inferred. */
const NEUTRAL_COLOR = "#5fd0c5"; // tailwind.config.ts `accent`

function spec(color: string, watermarkSlug: string | null): BannerSpec {
  // Three layers, painted back to front by the browser: a soft off-centre
  // radial bloom of the class colour, a diagonal sheen, then the dark base
  // ramp so the panel below reads as the same surface.
  return {
    background: [
      `radial-gradient(120% 160% at 22% 15%, ${color}59 0%, ${color}1f 38%, transparent 72%)`,
      `linear-gradient(115deg, ${color}26 0%, transparent 55%)`,
      `linear-gradient(180deg, #14171c 0%, #0e1013 100%)`,
    ].join(", "),
    watermarkSlug,
    color,
  };
}

const NEUTRAL = spec(NEUTRAL_COLOR, null);

const BY_CLASS: Record<ClassId, BannerSpec> = CLASSES.reduce((acc, c) => {
  acc[c.id] = spec(c.color, CLASS_ICON[c.id]);
  return acc;
}, {} as Record<ClassId, BannerSpec>);

/** String-safe lookup for DB values. Unknown/null falls back to neutral. */
export function bannerSpec(classId: string | null | undefined): BannerSpec {
  if (!classId) return NEUTRAL;
  return BY_CLASS[classId as ClassId] ?? NEUTRAL;
}

export function isBannerClassId(value: unknown): value is ClassId {
  return typeof value === "string" && value in BY_CLASS;
}

/** Picker options. `null` = follow the account's main character class. */
export const BANNER_OPTIONS: { classId: ClassId | null; name: string; spec: BannerSpec }[] = [
  { classId: null, name: "Follow my main", spec: NEUTRAL },
  ...CLASSES.map((c) => ({ classId: c.id, name: c.name, spec: BY_CLASS[c.id] })),
];
