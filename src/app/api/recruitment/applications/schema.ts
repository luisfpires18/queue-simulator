import { z } from "zod";
import { GUILD_STATUSES, MPLUS_STATUSES } from "@/game/applicationStatus";
import { MAX_BLOCK_REASON, MAX_REPORT_DETAIL, REPORT_CATEGORY_OPTIONS, REPORT_TARGET_TYPES } from "@/game/moderation";

// Validation for applying, status changes, and moderation actions. Same
// conventions as the Phase 1 schemas: unions derive from the vocabulary in
// src/game/ so validation cannot drift from the state machine.

const roleSchema = z.enum(["TANK", "HEALER", "DPS"]);
const specIdSchema = z.string().min(1).max(60);

const weeklySlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
});

export const applyInputSchema = z.object({
  recruitmentType: z.enum(["mplus", "guild"]),
  targetId: z.string().min(1),
  // Null is meaningful, not missing data: "general interest" is a valid
  // application to a guild with no matching opening today.
  positionId: z.string().min(1).nullish(),
  characterId: z.string().min(1),
  specId: specIdSchema,
  alternateSpecIds: z.array(specIdSchema).max(40).default([]),
  role: roleSchema,
  availability: z.array(weeklySlotSchema).max(40).default([]),
  note: z.string().max(2000).nullish(),
});

/** Every status in either vocabulary. WHICH ones are legal from the current
 * state, and for which actor, is decided by canActorTransition in the data
 * layer - restating that here would be a second source of truth. */
const ALL_STATUSES = [...new Set([...MPLUS_STATUSES, ...GUILD_STATUSES])] as [string, ...string[]];

export const statusInputSchema = z.object({
  status: z.enum(ALL_STATUSES),
});

export const recruiterNoteSchema = z.object({
  recruiterNote: z.string().max(2000).nullish(),
});

export const blockInputSchema = z.object({
  blockedUserId: z.string().min(1),
  reason: z.string().max(MAX_BLOCK_REASON).nullish(),
  /** false unblocks - one endpoint for both so the UI toggle is one call. */
  blocked: z.boolean().default(true),
});

export const reportInputSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES as unknown as [string, ...string[]]),
  targetId: z.string().min(1),
  category: z.enum(REPORT_CATEGORY_OPTIONS.map((o) => o.value) as unknown as [string, ...string[]]),
  detail: z.string().max(MAX_REPORT_DETAIL).nullish(),
});

export type ApplyInputBody = z.infer<typeof applyInputSchema>;
