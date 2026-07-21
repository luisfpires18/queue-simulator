// Shared vocabulary for the persistent recruitment system (Recruitment M+ and
// Guilds). Pure data + types, no I/O.
//
// Every union here is stored as a plain String column (SQLite has no enums, see
// prisma/schema.prisma) and validated with zod at the API edge. Keeping the
// unions and their human labels in one place means the zod schema, the form
// selects and the card badges can never drift apart - each imports the same
// `*_OPTIONS` array.

import type { WeeklySlot } from "./availability";

/** Turns an options array into the `{value: label}` map card renderers want. */
function labelMap<T extends string>(opts: readonly { value: T; label: string }[]): Record<T, string> {
  return Object.fromEntries(opts.map((o) => [o.value, o.label])) as Record<T, string>;
}

// ---------------------------------------------------------------------------
// Mythic+ recruitment
// ---------------------------------------------------------------------------

export type PostType = "player_lft" | "team_lfp" | "group_lfm" | "new_team";

export const POST_TYPE_OPTIONS = [
  { value: "player_lft", label: "Looking for a team", hint: "You want to join an existing team" },
  { value: "team_lfp", label: "Team looking for players", hint: "An established team with open spots" },
  { value: "group_lfm", label: "Group needs 1-2 more", hint: "A small group topping itself up" },
  { value: "new_team", label: "Forming a new team", hint: "Building a roster from scratch" },
] as const satisfies readonly { value: PostType; label: string; hint: string }[];

export const POST_TYPE_LABEL = labelMap(POST_TYPE_OPTIONS);

/** The three team-shaped postTypes. player_lft is the odd one out everywhere:
 * it has no teamName, no positions, and exactly one character. */
export const TEAM_POST_TYPES: readonly PostType[] = ["team_lfp", "group_lfm", "new_team"];

export function isTeamPost(postType: string): boolean {
  return TEAM_POST_TYPES.includes(postType as PostType);
}

export type TeamGoal = "push" | "timing" | "vault" | "learning" | "title" | "competitive";

export const GOAL_OPTIONS = [
  { value: "push", label: "Key pushing", hint: "Climbing as high as the roster allows" },
  { value: "timing", label: "Consistent timing", hint: "Reliably timing a comfortable range" },
  { value: "vault", label: "Weekly vault", hint: "Getting everyone their vault, no more" },
  { value: "learning", label: "Learning", hint: "Improving routes, pulls and play" },
  { value: "title", label: "Seasonal title", hint: "Chasing the season's title cutoff" },
  { value: "competitive", label: "Competitive ranking", hint: "Realm or regional leaderboard" },
] as const satisfies readonly { value: TeamGoal; label: string; hint: string }[];

export const GOAL_LABEL = labelMap(GOAL_OPTIONS);

/** Goals that sit next to each other in intent. Used by goalMatch() to call a
 * push/title pairing a partial match rather than a flat miss, since those
 * players do in fact want the same thing. */
export const GOAL_NEIGHBOURS: Record<TeamGoal, readonly TeamGoal[]> = {
  push: ["title", "competitive"],
  title: ["push", "competitive"],
  competitive: ["push", "title"],
  timing: ["vault", "push"],
  vault: ["timing", "learning"],
  learning: ["vault", "timing"],
};

export type TeamRole = "leader" | "officer" | "member" | "trial" | "substitute";

export const TEAM_ROLE_OPTIONS = [
  { value: "leader", label: "Leader" },
  { value: "officer", label: "Officer" },
  { value: "member", label: "Member" },
  { value: "trial", label: "Trial" },
  { value: "substitute", label: "Substitute" },
] as const satisfies readonly { value: TeamRole; label: string }[];

export const TEAM_ROLE_LABEL = labelMap(TEAM_ROLE_OPTIONS);

export type TeamMaturity = "new" | "established";

export const TEAM_MATURITY_OPTIONS = [
  { value: "new", label: "Newly formed" },
  { value: "established", label: "Established" },
] as const satisfies readonly { value: TeamMaturity; label: string }[];

export const TEAM_MATURITY_LABEL = labelMap(TEAM_MATURITY_OPTIONS);

export type Atmosphere = "chill" | "focused" | "competitive";

export const ATMOSPHERE_OPTIONS = [
  { value: "chill", label: "Relaxed", hint: "Social first, no pressure" },
  { value: "focused", label: "Focused", hint: "Serious about improving, still friendly" },
  { value: "competitive", label: "Competitive", hint: "Performance expectations are real" },
] as const satisfies readonly { value: Atmosphere; label: string; hint: string }[];

export const ATMOSPHERE_LABEL = labelMap(ATMOSPHERE_OPTIONS);

// ---------------------------------------------------------------------------
// Raid recruitment
// ---------------------------------------------------------------------------

export type RaidRecruitmentType =
  | "core"
  | "trial"
  | "substitute"
  | "bench"
  | "prog_replacement"
  | "farm"
  | "one_night";

export const RAID_RECRUITMENT_TYPE_OPTIONS = [
  { value: "core", label: "Permanent core", hint: "A full-time raid spot" },
  { value: "trial", label: "Trial", hint: "Trial period before a core spot" },
  { value: "substitute", label: "Substitute", hint: "Fills in when someone is out" },
  { value: "bench", label: "Bench", hint: "Rotates in and out by fight" },
  { value: "prog_replacement", label: "Progression replacement", hint: "Needed for the current boss" },
  { value: "farm", label: "Farm raider", hint: "Joins for cleared content only" },
  { value: "one_night", label: "One-night replacement", hint: "A single raid night" },
] as const satisfies readonly { value: RaidRecruitmentType; label: string; hint: string }[];

export const RAID_RECRUITMENT_TYPE_LABEL = labelMap(RAID_RECRUITMENT_TYPE_OPTIONS);

/** Mirrors RAID_DIFFICULTIES in src/game/raidSeason.ts, restated as a union so
 * the recruitment zod schemas can reference it without importing raid season
 * data into the API layer. */
export type RaidDifficulty = "normal" | "heroic" | "mythic";

export const RAID_DIFFICULTY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "heroic", label: "Heroic" },
  { value: "mythic", label: "Mythic" },
] as const satisfies readonly { value: RaidDifficulty; label: string }[];

export const RAID_DIFFICULTY_LABEL = labelMap(RAID_DIFFICULTY_OPTIONS);

/** Ordered weakest to strongest, so difficultyMatch() can reason about "one
 * step below what I want" instead of only exact equality. */
export const DIFFICULTY_ORDER: readonly RaidDifficulty[] = ["normal", "heroic", "mythic"];

export type BossExperienceState = "not_attempted" | "progressed" | "killed" | "farm";

export const BOSS_STATE_OPTIONS = [
  { value: "not_attempted", label: "Not attempted" },
  { value: "progressed", label: "Progressed" },
  { value: "killed", label: "Killed" },
  { value: "farm", label: "Farm" },
] as const satisfies readonly { value: BossExperienceState; label: string }[];

export const BOSS_STATE_LABEL = labelMap(BOSS_STATE_OPTIONS);

/** How far a raider got on one boss at one difficulty. Deliberately richer
 * than Character.raidKills (kill / no-kill only): "reached phase 3 on Mythic"
 * is precisely the signal a progression guild recruits on, and collapsing it
 * to "no kill" throws away the useful half. */
export interface BossExperience {
  raidId: string; // see RAID_BY_ID in src/game/raidSeason.ts
  bossId: string;
  difficulty: RaidDifficulty;
  state: BossExperienceState;
  phaseReached?: number; // only meaningful when state === "progressed"
  kills?: number; // only meaningful when state === "killed" | "farm"
  lastPullAt?: string; // ISO date - lets a guild weigh recency, never required
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type RecruitmentStatus = "open" | "paused" | "closed" | "filled" | "expired";

export const RECRUITMENT_STATUS_OPTIONS = [
  { value: "open", label: "Recruiting" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
  // Set only by the expiry sweep, never by the owner - which is why it is
  // absent from the status zod enums the API accepts. Distinct from "closed"
  // on purpose: a closed listing was a decision, an expired one just lapsed,
  // and only the second should be offered a one-click refresh to relist.
  { value: "expired", label: "Expired" },
] as const satisfies readonly { value: RecruitmentStatus; label: string }[];

export const RECRUITMENT_STATUS_LABEL = labelMap(RECRUITMENT_STATUS_OPTIONS);

/** Only "open" listings appear in browse. The rest stay visible to their owner
 * under My Recruitment so a paused post can be resumed rather than recreated. */
export function isBrowsable(status: string): boolean {
  return status === "open";
}

export type Region = "eu" | "us" | "kr" | "tw" | "cn";

export const REGION_OPTIONS = [
  { value: "eu", label: "EU" },
  { value: "us", label: "US" },
  { value: "kr", label: "KR" },
  { value: "tw", label: "TW" },
  { value: "cn", label: "CN" },
] as const satisfies readonly { value: Region; label: string }[];

export const REGION_LABEL = labelMap(REGION_OPTIONS);

/** ISO 639-1 codes for the languages actually spoken in WoW group finding.
 * Not the full ISO list on purpose - a 180-entry select is unusable, and the
 * long tail is better served by the free-text description. */
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "pl", label: "Polish" },
  { value: "nl", label: "Dutch" },
  { value: "sv", label: "Swedish" },
  { value: "no", label: "Norwegian" },
  { value: "da", label: "Danish" },
  { value: "fi", label: "Finnish" },
  { value: "cs", label: "Czech" },
  { value: "tr", label: "Turkish" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
] as const;

export const LANGUAGE_LABEL: Record<string, string> = labelMap(LANGUAGE_OPTIONS);

export function languageLabel(code: string): string {
  return LANGUAGE_LABEL[code] ?? code.toUpperCase();
}

/** Common IANA zones, grouped by region so the select is scannable. Free-text
 * IANA ids still validate server-side; this is only the shortlist the picker
 * offers. */
export const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Lisbon", label: "Lisbon (WET/WEST)" },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET/CEST)" },
  { value: "Europe/Warsaw", label: "Warsaw (CET/CEST)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET/EEST)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Sao_Paulo", label: "Sao Paulo (BRT)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Asia/Taipei", label: "Taipei (CST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AET)" },
] as const;

export const VOICE_PLATFORM_OPTIONS = [
  { value: "discord", label: "Discord" },
  { value: "teamspeak", label: "TeamSpeak" },
  { value: "in_game", label: "In-game voice" },
  { value: "other", label: "Other" },
] as const;

export const VOICE_PLATFORM_LABEL: Record<string, string> = labelMap(VOICE_PLATFORM_OPTIONS);

export const COMPETITIVE_LEVEL_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "semi_hardcore", label: "Semi-hardcore" },
  { value: "hardcore", label: "Hardcore" },
] as const;

export const COMPETITIVE_LEVEL_LABEL: Record<string, string> = labelMap(COMPETITIVE_LEVEL_OPTIONS);

/** Key levels the pickers offer. Upper bound matches the existing listing
 * schema's max in src/app/api/groups/schema.ts. */
export const MIN_KEY_LEVEL = 2;
export const MAX_KEY_LEVEL = 40;

/** The availability payload shape, re-exported so consumers importing the
 * recruitment vocabulary don't need a second import for the schedule type. */
export type { WeeklySlot };
