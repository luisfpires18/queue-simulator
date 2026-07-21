import { z } from "zod";
import { countryByCode } from "@/game/countries";
import {
  ATMOSPHERE_OPTIONS,
  GOAL_OPTIONS,
  MAX_KEY_LEVEL,
  MIN_KEY_LEVEL,
  POST_TYPE_OPTIONS,
  REGION_OPTIONS,
  TEAM_MATURITY_OPTIONS,
  TEAM_ROLE_OPTIONS,
  VOICE_PLATFORM_OPTIONS,
} from "@/game/recruitmentTypes";

// Shared by POST /api/recruitment/mplus (create) and PATCH .../[id] (edit) -
// same shape either way, just a different persistence call, matching how
// src/app/api/groups/schema.ts is organised.
//
// Every union below is derived from the option arrays in
// src/game/recruitmentTypes.ts rather than being restated, so adding a goal or
// a post type in one place cannot leave validation behind.

/** Builds a zod enum from an options array's `value`s. */
const valuesOf = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [string, ...string[]];

const roleSchema = z.enum(["TANK", "HEALER", "DPS"]);
const specIdSchema = z.string().min(1).max(60);
const specListSchema = z.array(specIdSchema).max(40).default([]);

/** A weekly availability block. endMin may be <= startMin, which the domain
 * reads as wrapping past midnight (see src/game/availability.ts) - so this
 * deliberately does NOT require endMin > startMin. */
const weeklySlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
});

// Bounded so one post can't carry a thousand slots. 7 days x a few blocks a
// day is the realistic ceiling.
const availabilitySchema = z.array(weeklySlotSchema).max(40).default([]);

const languagesSchema = z.array(z.string().min(2).max(8)).min(1).max(10);

/** Validated against the real ISO list rather than just "two letters", so the
 * flag lookup on the card can never 404 on a made-up code. Shared with the
 * guild schema via the same helper in src/game/countries.ts that the profile
 * Settings tab already uses. */
export const countrySchema = z
  .string()
  .length(2)
  .transform((v) => v.toUpperCase())
  .refine((v) => !!countryByCode(v), { message: "Unknown country code." })
  .nullish();

const keyLevelSchema = z.number().int().min(MIN_KEY_LEVEL).max(MAX_KEY_LEVEL);

const characterSchema = z.object({
  characterId: z.string().min(1),
  primarySpecId: specIdSchema,
  alternateSpecIds: specListSchema,
  preferredRole: roleSchema,
  willingRoles: z.array(roleSchema).max(3).default([]),
  isMain: z.boolean().default(false),
  isCurrentMember: z.boolean().default(false),
  teamRole: z.enum(valuesOf(TEAM_ROLE_OPTIONS)).nullish(),
});

const positionSchema = z.object({
  role: roleSchema,
  preferredSpecIds: specListSchema,
  acceptedSpecIds: specListSchema,
  priority: z.number().int().min(-1).max(1).default(0),
  isPermanent: z.boolean().default(true),
  isFlexible: z.boolean().default(false),
  isFilled: z.boolean().default(false),
});

export const mplusPostInputSchema = z
  .object({
    postType: z.enum(valuesOf(POST_TYPE_OPTIONS)),
    title: z.string().min(1).max(80),
    description: z.string().max(2000).nullish(),
    teamName: z.string().max(60).nullish(),

    region: z.enum(valuesOf(REGION_OPTIONS)),
    country: countrySchema,
    languages: languagesSchema,
    // Free-text IANA id rather than an enum: the picker offers a shortlist but
    // any valid zone must be storable, and an unknown zone degrades to UTC in
    // tzOffsetMinutes rather than breaking.
    timeZone: z.string().max(64).nullish(),
    availability: availabilitySchema,

    goal: z.enum(valuesOf(GOAL_OPTIONS)),
    currentKeyMin: keyLevelSchema.nullish(),
    currentKeyMax: keyLevelSchema.nullish(),
    targetKeyMin: keyLevelSchema.nullish(),
    targetKeyMax: keyLevelSchema.nullish(),

    voiceRequired: z.boolean().default(false),
    voicePlatform: z.enum(valuesOf(VOICE_PLATFORM_OPTIONS)).nullish(),
    teamMaturity: z.enum(valuesOf(TEAM_MATURITY_OPTIONS)).nullish(),
    atmosphere: z.enum(valuesOf(ATMOSPHERE_OPTIONS)).nullish(),

    showLogs: z.boolean().default(false),
    showProfile: z.boolean().default(true),

    // Capped well above any real roster - a five-person M+ team plus subs.
    characters: z.array(characterSchema).min(1).max(20),
    positions: z.array(positionSchema).max(10).default([]),
  })
  .superRefine((data, ctx) => {
    const isTeam = data.postType !== "player_lft";

    // A player advertising themselves is exactly one character; a team is a
    // roster. Enforced here rather than in two separate schemas because every
    // other field is identical.
    if (!isTeam && data.characters.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["characters"],
        message: "A 'looking for a team' post is about exactly one character.",
      });
    }

    if (isTeam && !data.teamName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamName"],
        message: "Team posts need a team name.",
      });
    }

    // A team advertising nothing is not recruiting. Without this a team post
    // browses as a listing nobody can apply to.
    if (isTeam && !data.positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["positions"],
        message: "Add at least one open position so players know what you need.",
      });
    }

    if (
      data.currentKeyMin != null &&
      data.currentKeyMax != null &&
      data.currentKeyMin > data.currentKeyMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentKeyMax"],
        message: "The maximum key level cannot be below the minimum.",
      });
    }
    if (data.targetKeyMin != null && data.targetKeyMax != null && data.targetKeyMin > data.targetKeyMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetKeyMax"],
        message: "The target maximum cannot be below the target minimum.",
      });
    }

    // The same character twice on one roster is always a mistake, and the DB's
    // @@unique would surface it as an opaque 500.
    const ids = data.characters.map((c) => c.characterId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["characters"],
        message: "The same character is listed more than once.",
      });
    }
  });

export const statusInputSchema = z.object({
  status: z.enum(["open", "paused", "closed", "filled"]),
});

export const rosterMemberSchema = characterSchema;

export const positionFilledSchema = z.object({
  positionId: z.string().min(1),
  isFilled: z.boolean(),
});

export type MPlusPostInput = z.infer<typeof mplusPostInputSchema>;
