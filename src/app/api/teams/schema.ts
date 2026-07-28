import { z } from "zod";
import { isLanguageCode } from "@/game/languages";
import { DEFAULT_TEAM_ICON, isTeamIconSlug } from "@/game/teamIcons";
import { PARTY_SIZE } from "@/game/teamRoster";

// Shared by POST /api/teams (create) and PATCH /api/teams/[id] (edit). Unlike
// groupInputSchema there is no per-kind split - every team is a Mythic+ team.
const slotsSchema = z
  .array(
    z.object({
      role: z.enum(["TANK", "HEALER", "DPS"]),
      prefs: z.array(z.string()).default([]),
    })
  )
  // A team is a fixed 5-man party, so at most the party minus the leader is
  // ever open. The exact per-role split is derived client-side from the
  // roster (see openRoleSlots); this is just the sanity bound.
  .max(PARTY_SIZE - 1)
  .default([]);

export const teamInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().max(500).nullish(),
  // Optional while the create form has no icon picker; still allowlisted
  // rather than free-text, since this slug is rendered on other people's
  // profiles (see src/game/teamIcons.ts). Re-exposing the picker needs no
  // change here.
  iconSlug: z.string().refine(isTeamIconSlug, "Unknown team icon").optional().default(DEFAULT_TEAM_ICON),

  // Allowlisted the same way, since it drives a label other people read.
  language: z.string().refine(isLanguageCode, "Unknown language").nullish(),
  voiceChat: z.string().max(60).nullish(),

  ownerRole: z.enum(["TANK", "HEALER", "DPS"]),
  ownerCharacterId: z.string(),
  ownerSpecId: z.string(),

  slots: slotsSchema,

  // Same advisory requirement vocabulary and bounds as a Group listing.
  requirementType: z.enum(["rating", "resilient", "custom"]).nullish(),
  reqRating: z.number().int().min(0).max(6000).nullish(),
  reqLevel: z.number().int().min(2).max(40).nullish(),
  reqExtraCount: z.number().int().min(1).max(7).nullish(),
  reqExtraLevel: z.number().int().min(2).max(40).nullish(),
});

export const teamApplySchema = z.object({
  characterId: z.string(),
  specId: z.string(),
  role: z.enum(["TANK", "HEALER", "DPS"]),
  note: z.string().max(500).nullish(),
});
