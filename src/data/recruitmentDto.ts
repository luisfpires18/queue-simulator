// Data-transfer shapes for the persistent recruitment system (Recruitment M+
// and Guilds). Types only - no runtime imports - matching src/data/dto.ts, so
// client components can `import type` from here without pulling in Prisma.
//
// Kept out of dto.ts deliberately: that file is the live one-key board's
// vocabulary and is already long. Nothing here is shared with GroupDTO.
import type { CharacterDTO } from "./dto";
import type { BossExperience, WeeklySlot } from "@/game/recruitmentTypes";

// ---------------------------------------------------------------------------
// Mythic+
// ---------------------------------------------------------------------------

/** A character on a recruitment post - either the advertiser themselves
 * (postType "player_lft") or one roster member of a team. */
export interface MPlusRecruitmentCharacterDTO {
  id: string;
  characterId: string;
  primarySpecId: string;
  alternateSpecIds: string[];
  preferredRole: string; // TANK | HEALER | DPS
  willingRoles: string[];
  isMain: boolean;
  isCurrentMember: boolean;
  teamRole: string | null; // leader | officer | member | trial | substitute
  /** The live character record, so cards can show class colour, rating and
   * ilvl without a second query. */
  character: CharacterDTO;
}

export interface MPlusRecruitmentPositionDTO {
  id: string;
  role: string;
  preferredSpecIds: string[];
  acceptedSpecIds: string[];
  priority: number;
  isPermanent: boolean;
  isFlexible: boolean;
  isFilled: boolean;
}

export interface MPlusRecruitmentPostDTO {
  id: string;
  ownerUserId: string;
  postType: string; // see PostType in src/game/recruitmentTypes.ts
  title: string;
  description: string | null;
  teamName: string | null;

  region: string;
  /** ISO 3166-1 alpha-2, or null. Separate from `region`: that is the game
   * region and drives matching, this is the flag shown on the card. */
  country: string | null;
  languages: string[];
  timeZone: string | null;
  availability: WeeklySlot[];

  goal: string;
  currentKeyMin: number | null;
  currentKeyMax: number | null;
  targetKeyMin: number | null;
  targetKeyMax: number | null;

  voiceRequired: boolean;
  voicePlatform: string | null;
  teamMaturity: string | null;
  atmosphere: string | null;

  showLogs: boolean;
  showProfile: boolean;

  status: string;
  createdAt: string;
  updatedAt: string;
  refreshedAt: string;
  expiresAt: string;

  characters: MPlusRecruitmentCharacterDTO[];
  positions: MPlusRecruitmentPositionDTO[];
}

// ---------------------------------------------------------------------------
// Guilds
// ---------------------------------------------------------------------------

export interface RaidRecruitmentPositionDTO {
  id: string;
  role: string;
  preferredSpecIds: string[];
  acceptedSpecIds: string[];
  recruitmentType: string;
  priority: number;
  isFilled: boolean;
}

export interface RaidTeamDTO {
  id: string;
  guildId: string;
  name: string;
  difficulty: string;

  currentProgression: string | null;
  currentRaidId: string | null;
  currentBossesKilled: number | null;
  previousProgression: string | null;

  availability: WeeklySlot[];
  timeZone: string | null;

  voicePlatform: string | null;
  attendanceRequirement: number | null;
  trialDuration: string | null;
  benchPolicy: string | null;
  lootPolicy: string | null;
  expectations: string | null;
  requiredAddons: string[];

  status: string;
  createdAt: string;
  updatedAt: string;
  refreshedAt: string;
  expiresAt: string;

  positions: RaidRecruitmentPositionDTO[];
  /** Populated on browse/detail reads so a team card can show its guild name
   * without the caller joining separately. */
  guild?: GuildSummaryDTO;
}

export interface GuildSummaryDTO {
  id: string;
  name: string;
  region: string;
  country: string | null;
  realm: string | null;
  realmSlug: string | null;
  faction: string | null;
  languages: string[];
}

export interface GuildDTO extends GuildSummaryDTO {
  ownerUserId: string;
  description: string | null;
  culture: string | null;
  size: number | null;
  discordUrl: string | null;
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
  raidTeams: RaidTeamDTO[];
}

export interface RaiderProfileDTO {
  id: string;
  ownerUserId: string;
  characterId: string;

  primarySpecId: string;
  alternateSpecIds: string[];
  preferredRole: string;
  offRoles: string[];

  title: string | null;
  introduction: string | null;

  region: string;
  country: string | null;
  languages: string[];
  timeZone: string | null;
  availability: WeeklySlot[];

  preferredDifficulty: string;
  currentProgression: string | null;
  previousProgression: string | null;
  bossExperience: BossExperience[];

  attendanceExpectation: number | null;
  voiceAvailable: boolean;
  transferWilling: boolean;
  factionFlexible: boolean;

  atmosphere: string | null;
  competitiveLevel: string | null;
  trialAvailable: boolean;

  showLogs: boolean;
  showProfile: boolean;

  status: string;
  createdAt: string;
  updatedAt: string;
  refreshedAt: string;
  expiresAt: string;

  character: CharacterDTO;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface RecruitmentCharacterInput {
  characterId: string;
  primarySpecId: string;
  alternateSpecIds?: string[];
  preferredRole: string;
  willingRoles?: string[];
  isMain?: boolean;
  isCurrentMember?: boolean;
  teamRole?: string | null;
}

export interface RecruitmentPositionInput {
  role: string;
  preferredSpecIds?: string[];
  acceptedSpecIds?: string[];
  priority?: number;
  isPermanent?: boolean;
  isFlexible?: boolean;
  isFilled?: boolean;
}

export interface CreateMPlusPostInput {
  postType: string;
  title: string;
  description?: string | null;
  teamName?: string | null;
  region: string;
  country?: string | null;
  languages: string[];
  timeZone?: string | null;
  availability: WeeklySlot[];
  goal: string;
  currentKeyMin?: number | null;
  currentKeyMax?: number | null;
  targetKeyMin?: number | null;
  targetKeyMax?: number | null;
  voiceRequired?: boolean;
  voicePlatform?: string | null;
  teamMaturity?: string | null;
  atmosphere?: string | null;
  showLogs?: boolean;
  showProfile?: boolean;
  characters: RecruitmentCharacterInput[];
  positions?: RecruitmentPositionInput[];
}

export interface RaidPositionInput {
  role: string;
  preferredSpecIds?: string[];
  acceptedSpecIds?: string[];
  recruitmentType: string;
  priority?: number;
  isFilled?: boolean;
}

export interface CreateGuildInput {
  name: string;
  region: string;
  country?: string | null;
  realm?: string | null;
  faction?: string | null;
  description?: string | null;
  culture?: string | null;
  size?: number | null;
  languages: string[];
  discordUrl?: string | null;
  websiteUrl?: string | null;
}

export interface CreateRaidTeamInput {
  name: string;
  difficulty: string;
  currentProgression?: string | null;
  currentRaidId?: string | null;
  currentBossesKilled?: number | null;
  previousProgression?: string | null;
  availability: WeeklySlot[];
  timeZone?: string | null;
  voicePlatform?: string | null;
  attendanceRequirement?: number | null;
  trialDuration?: string | null;
  benchPolicy?: string | null;
  lootPolicy?: string | null;
  expectations?: string | null;
  requiredAddons?: string[];
  positions?: RaidPositionInput[];
}

export interface CreateRaiderProfileInput {
  characterId: string;
  primarySpecId: string;
  alternateSpecIds?: string[];
  preferredRole: string;
  offRoles?: string[];
  title?: string | null;
  introduction?: string | null;
  region: string;
  country?: string | null;
  languages: string[];
  timeZone?: string | null;
  availability: WeeklySlot[];
  preferredDifficulty: string;
  currentProgression?: string | null;
  previousProgression?: string | null;
  bossExperience?: BossExperience[];
  attendanceExpectation?: number | null;
  voiceAvailable?: boolean;
  transferWilling?: boolean;
  factionFlexible?: boolean;
  atmosphere?: string | null;
  competitiveLevel?: string | null;
  trialAvailable?: boolean;
  showLogs?: boolean;
  showProfile?: boolean;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Browse filters for Recruitment M+. Every field is optional: an empty filter
 * object means "all open, unexpired posts". */
export interface MPlusPostFilters {
  postType?: string;
  postTypes?: string[];
  region?: string;
  languages?: string[];
  goal?: string;
  role?: string; // a position in this role must be open
  specId?: string; // that position must accept this spec
  keyMin?: number;
  keyMax?: number;
  voiceRequired?: boolean;
  teamMaturity?: string;
  isPermanent?: boolean;
  ownerUserId?: string; // My Recruitment: bypasses the status/expiry filters
  includeExpired?: boolean;
  limit?: number;
  /** The signed-in viewer, when there is one. Listings owned by anyone they
   * have blocked (or who has blocked them) are hidden. Distinct from
   * ownerUserId, which is the "show me MY posts" filter. */
  viewerUserId?: string;
}

export interface RaidTeamFilters {
  region?: string;
  languages?: string[];
  difficulty?: string;
  role?: string;
  specId?: string;
  recruitmentType?: string;
  ownerUserId?: string;
  includeExpired?: boolean;
  limit?: number;
  viewerUserId?: string;
}

export interface RaiderProfileFilters {
  region?: string;
  languages?: string[];
  difficulty?: string;
  role?: string;
  atmosphere?: string;
  trialAvailable?: boolean;
  ownerUserId?: string;
  includeExpired?: boolean;
  limit?: number;
  viewerUserId?: string;
}
