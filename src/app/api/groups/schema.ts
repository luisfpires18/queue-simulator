import { z } from "zod";

// Shared by POST /api/groups (create) and PATCH /api/groups/[id] (edit) —
// same shape either way, just a different persistence call on the other end.
// Split by `kind` since M+ (dungeonId/keyLevel, combos up to 4) and raid
// (raidId/raidDifficulty/raidSize, combos up to the roster size itself)
// validate differently.
const slotsSchema = z
  .array(
    z.object({
      role: z.enum(["TANK", "HEALER", "DPS"]),
      prefs: z.array(z.string()).default([]),
    })
  )
  .default([]);

const combosSchema = (maxMembers: number) =>
  z
    .array(
      z
        .array(z.object({ role: z.enum(["TANK", "HEALER", "DPS"]), specId: z.string() }))
        .min(2)
        .max(maxMembers)
    )
    .max(10)
    .default([]);

const baseFields = {
  title: z.string().min(1).max(60),
  description: z.string().max(500).nullish(),
  ownerRole: z.enum(["TANK", "HEALER", "DPS"]),
  ownerCharacterId: z.string(),
  ownerSpecId: z.string(),
  startsAt: z.string().datetime().nullish(),
  slots: slotsSchema,

  // ---- applicant requirement (optional, advisory only) ----
  requirementType: z.enum(["rating", "resilient", "custom"]).nullish(),
  reqRating: z.number().int().min(0).max(6000).nullish(),
  reqLevel: z.number().int().min(2).max(40).nullish(),
  reqExtraCount: z.number().int().min(1).max(7).nullish(),
  reqExtraLevel: z.number().int().min(2).max(40).nullish(),
};

const mplusGroupSchema = z.object({
  ...baseFields,
  kind: z.literal("mplus").default("mplus"),
  dungeonId: z.string(),
  keyLevel: z.number().int().min(2).max(40),
  combos: combosSchema(4),
});

const raidGroupSchema = z
  .object({
    ...baseFields,
    kind: z.literal("raid"),
    raidId: z.string(),
    raidDifficulty: z.enum(["normal", "heroic", "mythic"]),
    // No fixed range - the owner freely types tank/healer/dps counts and this
    // is just their sum (Mythic's true fixed-20 rule, where it applies, is
    // enforced client-side in RaidListForm, not here). Generous ceiling only as
    // a sanity bound against garbage input, not a game-accurate limit.
    raidSize: z.number().int().min(1).max(100),
    // Same ceiling as raidSize - the real per-request bound (a combo can't
    // exceed the roster the owner actually typed) is enforced below, since a
    // combo's max size is only known once raidSize is parsed.
    combos: combosSchema(100),
  })
  .superRefine((data, ctx) => {
    for (const combo of data.combos) {
      if (combo.length > data.raidSize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["combos"],
          message: `A combo has ${combo.length} members, more than the roster size (${data.raidSize}).`,
        });
      }
    }
  });

export const groupInputSchema = z.union([mplusGroupSchema, raidGroupSchema]);
