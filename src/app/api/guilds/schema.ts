import { z } from "zod";
// Reuses the recruitment schema's ISO-validated country field so both areas
// accept exactly the codes the shared CountrySelect can render a flag for.
import { countrySchema } from "../recruitment/mplus/schema";
import {
  ATMOSPHERE_OPTIONS,
  COMPETITIVE_LEVEL_OPTIONS,
  RAID_DIFFICULTY_OPTIONS,
  RAID_RECRUITMENT_TYPE_OPTIONS,
  REGION_OPTIONS,
  VOICE_PLATFORM_OPTIONS,
  type BossExperienceState,
  type RaidDifficulty,
} from "@/game/recruitmentTypes";

// Validation for guilds, their raid teams, and raider profiles. Same
// conventions as src/app/api/recruitment/mplus/schema.ts: unions derive from
// the option arrays in src/game/recruitmentTypes.ts so validation cannot drift
// from the pickers.

const valuesOf = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [string, ...string[]];

// Difficulty and boss state are spelled out as literal tuples rather than
// going through valuesOf: that helper widens to `string`, and these two values
// flow straight into BossExperience, whose fields are narrow unions. Widening
// them here would fail to type-check at the data layer. The
// `satisfies`-checked constants keep them honest against the option arrays.
const DIFFICULTY_VALUES = ["normal", "heroic", "mythic"] as const satisfies readonly RaidDifficulty[];
const BOSS_STATE_VALUES = [
  "not_attempted",
  "progressed",
  "killed",
  "farm",
] as const satisfies readonly BossExperienceState[];

const roleSchema = z.enum(["TANK", "HEALER", "DPS"]);
const specIdSchema = z.string().min(1).max(60);
const specListSchema = z.array(specIdSchema).max(40).default([]);

const weeklySlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
});
const availabilitySchema = z.array(weeklySlotSchema).max(40).default([]);
const languagesSchema = z.array(z.string().min(2).max(8)).min(1).max(10);

/** Links are rendered as anchors on a public page, so the scheme is
 * restricted to http(s). Without this, a javascript: or data: URL would be
 * stored and later clicked by another user. */
const urlSchema = z
  .string()
  .trim()
  .max(300)
  .url()
  .refine((v) => /^https?:\/\//i.test(v), { message: "Links must start with http:// or https://" });

// ---------------------------------------------------------------------------
// Guild
// ---------------------------------------------------------------------------

export const guildInputSchema = z.object({
  name: z.string().min(2).max(60),
  region: z.enum(valuesOf(REGION_OPTIONS)),
  country: countrySchema,
  realm: z.string().max(60).nullish(),
  faction: z.enum(["Alliance", "Horde"]).nullish(),
  description: z.string().max(3000).nullish(),
  culture: z.string().max(2000).nullish(),
  size: z.number().int().min(1).max(2000).nullish(),
  languages: languagesSchema,
  discordUrl: urlSchema.nullish(),
  websiteUrl: urlSchema.nullish(),
});

// ---------------------------------------------------------------------------
// Raid team
// ---------------------------------------------------------------------------

const raidPositionSchema = z.object({
  role: roleSchema,
  preferredSpecIds: specListSchema,
  acceptedSpecIds: specListSchema,
  recruitmentType: z.enum(valuesOf(RAID_RECRUITMENT_TYPE_OPTIONS)),
  // -1 is "listed but closed", which guilds use to say "not currently
  // recruiting healers" rather than omitting the role entirely.
  priority: z.number().int().min(-1).max(1).default(0),
  isFilled: z.boolean().default(false),
});

export const raidTeamInputSchema = z
  .object({
    name: z.string().min(1).max(60),
    difficulty: z.enum(valuesOf(RAID_DIFFICULTY_OPTIONS)),

    currentProgression: z.string().max(100).nullish(),
    currentRaidId: z.string().max(60).nullish(),
    currentBossesKilled: z.number().int().min(0).max(30).nullish(),
    previousProgression: z.string().max(100).nullish(),

    availability: availabilitySchema,
    timeZone: z.string().max(64).nullish(),

    voicePlatform: z.enum(valuesOf(VOICE_PLATFORM_OPTIONS)).nullish(),
    attendanceRequirement: z.number().int().min(0).max(100).nullish(),
    trialDuration: z.string().max(60).nullish(),
    benchPolicy: z.string().max(1000).nullish(),
    lootPolicy: z.string().max(1000).nullish(),
    expectations: z.string().max(2000).nullish(),
    requiredAddons: z.array(z.string().min(1).max(60)).max(20).default([]),

    positions: z.array(raidPositionSchema).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.positions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["positions"],
        message: "Add at least one open position so raiders know what you need.",
      });
    }
    // Structured progression only means something with a raid to anchor it to.
    if (data.currentBossesKilled != null && !data.currentRaidId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentRaidId"],
        message: "Pick the raid this progression refers to.",
      });
    }
  });

// ---------------------------------------------------------------------------
// Raider profile
// ---------------------------------------------------------------------------

const bossExperienceSchema = z.object({
  raidId: z.string().min(1).max(60),
  bossId: z.string().min(1).max(60),
  difficulty: z.enum(DIFFICULTY_VALUES),
  state: z.enum(BOSS_STATE_VALUES),
  phaseReached: z.number().int().min(1).max(20).optional(),
  kills: z.number().int().min(0).max(999).optional(),
  lastPullAt: z.string().datetime().optional(),
});

export const raiderProfileInputSchema = z
  .object({
    characterId: z.string().min(1),
    primarySpecId: specIdSchema,
    alternateSpecIds: specListSchema,
    preferredRole: roleSchema,
    offRoles: z.array(roleSchema).max(3).default([]),

    title: z.string().max(80).nullish(),
    introduction: z.string().max(2000).nullish(),

    region: z.enum(valuesOf(REGION_OPTIONS)),
    country: countrySchema,
    languages: languagesSchema,
    timeZone: z.string().max(64).nullish(),
    availability: availabilitySchema,

    preferredDifficulty: z.enum(valuesOf(RAID_DIFFICULTY_OPTIONS)),
    currentProgression: z.string().max(100).nullish(),
    previousProgression: z.string().max(100).nullish(),
    // Bounded at roughly two tiers of bosses across three difficulties.
    bossExperience: z.array(bossExperienceSchema).max(120).default([]),

    attendanceExpectation: z.number().int().min(0).max(100).nullish(),
    voiceAvailable: z.boolean().default(true),
    transferWilling: z.boolean().default(false),
    factionFlexible: z.boolean().default(false),

    atmosphere: z.enum(valuesOf(ATMOSPHERE_OPTIONS)).nullish(),
    competitiveLevel: z.enum(valuesOf(COMPETITIVE_LEVEL_OPTIONS)).nullish(),
    trialAvailable: z.boolean().default(true),

    showLogs: z.boolean().default(false),
    showProfile: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // A phase only means something while still progressing; a kill supersedes it.
    for (const [i, b] of data.bossExperience.entries()) {
      if (b.phaseReached != null && b.state !== "progressed") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bossExperience", i, "phaseReached"],
          message: "A phase only applies to a boss still being progressed.",
        });
      }
    }
  });

export const guildStatusInputSchema = z.object({
  status: z.enum(["open", "paused", "closed"]),
});

export const raiderStatusInputSchema = z.object({
  status: z.enum(["open", "paused", "closed", "filled"]),
});

/** Guild listings live 30 days, long enough that a silent bump would keep dead
 * rosters alive - so a refresh must carry an explicit confirmation that
 * recruitment is still active. */
export const refreshInputSchema = z.object({
  stillRecruiting: z.literal(true, {
    errorMap: () => ({ message: "Confirm that this team is still recruiting." }),
  }),
});

export type GuildInput = z.infer<typeof guildInputSchema>;
export type RaidTeamInput = z.infer<typeof raidTeamInputSchema>;
export type RaiderProfileInput = z.infer<typeof raiderProfileInputSchema>;
