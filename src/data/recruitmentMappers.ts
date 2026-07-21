// Prisma-row -> DTO mappers for the recruitment tables, plus the defensive
// parsers for their JSON-string columns. Same contract as src/data/mappers.ts:
// a malformed column degrades to empty rather than 500-ing a browse query,
// since nothing validates these at the DB level.
import { charDTO } from "./mappers";
import type {
  GuildDTO,
  GuildSummaryDTO,
  MPlusRecruitmentCharacterDTO,
  MPlusRecruitmentPositionDTO,
  MPlusRecruitmentPostDTO,
  RaidRecruitmentPositionDTO,
  RaidTeamDTO,
  RaiderProfileDTO,
} from "./recruitmentDto";
import type { BossExperience, RaidDifficulty } from "@/game/recruitmentTypes";
import { normalizeSlots, type WeeklySlot } from "@/game/availability";

// ---------------------------------------------------------------------------
// JSON column parsers
// ---------------------------------------------------------------------------

/** JSON string[] - used for languages, spec id lists, roles and addons. */
export function parseStringArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** JSON WeeklySlot[]. Runs through normalizeSlots so out-of-range days and
 * zero-length blocks never reach the matching functions. */
export function parseAvailability(s: string): WeeklySlot[] {
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) return [];
    const raw = v.filter(
      (x) => x && typeof x.day === "number" && typeof x.startMin === "number" && typeof x.endMin === "number"
    );
    return normalizeSlots(raw);
  } catch {
    return [];
  }
}

const DIFFICULTIES = new Set(["normal", "heroic", "mythic"]);
const BOSS_STATES = new Set(["not_attempted", "progressed", "killed", "farm"]);

export function parseBossExperience(s: string): BossExperience[] {
  try {
    const v = JSON.parse(s);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x) =>
          x &&
          typeof x.raidId === "string" &&
          typeof x.bossId === "string" &&
          typeof x.difficulty === "string" &&
          DIFFICULTIES.has(x.difficulty) &&
          typeof x.state === "string" &&
          BOSS_STATES.has(x.state)
      )
      .map((x) => ({
        raidId: x.raidId,
        bossId: x.bossId,
        difficulty: x.difficulty as RaidDifficulty,
        state: x.state,
        phaseReached: typeof x.phaseReached === "number" ? x.phaseReached : undefined,
        kills: typeof x.kills === "number" ? x.kills : undefined,
        lastPullAt: typeof x.lastPullAt === "string" ? x.lastPullAt : undefined,
      }));
  } catch {
    return [];
  }
}

/** The inverse, for writes. Centralised so every caller stringifies the same
 * way and a future column-type change has one place to edit. */
export function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

// ---------------------------------------------------------------------------
// Mythic+
// ---------------------------------------------------------------------------

type CharRow = Parameters<typeof charDTO>[0];

export function mplusCharacterDTO(c: {
  id: string;
  characterId: string;
  primarySpecId: string;
  alternateSpecIds: string;
  preferredRole: string;
  willingRoles: string;
  isMain: boolean;
  isCurrentMember: boolean;
  teamRole: string | null;
  character: CharRow;
}): MPlusRecruitmentCharacterDTO {
  return {
    id: c.id,
    characterId: c.characterId,
    primarySpecId: c.primarySpecId,
    alternateSpecIds: parseStringArray(c.alternateSpecIds),
    preferredRole: c.preferredRole,
    willingRoles: parseStringArray(c.willingRoles),
    isMain: c.isMain,
    isCurrentMember: c.isCurrentMember,
    teamRole: c.teamRole,
    character: charDTO(c.character),
  };
}

export function mplusPositionDTO(p: {
  id: string;
  role: string;
  preferredSpecIds: string;
  acceptedSpecIds: string;
  priority: number;
  isPermanent: boolean;
  isFlexible: boolean;
  isFilled: boolean;
}): MPlusRecruitmentPositionDTO {
  return {
    id: p.id,
    role: p.role,
    preferredSpecIds: parseStringArray(p.preferredSpecIds),
    acceptedSpecIds: parseStringArray(p.acceptedSpecIds),
    priority: p.priority,
    isPermanent: p.isPermanent,
    isFlexible: p.isFlexible,
    isFilled: p.isFilled,
  };
}

export function mplusPostDTO(p: {
  id: string;
  ownerUserId: string;
  postType: string;
  title: string;
  description: string | null;
  teamName: string | null;
  region: string;
  country: string | null;
  languages: string;
  timeZone: string | null;
  availability: string;
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
  createdAt: Date;
  updatedAt: Date;
  refreshedAt: Date;
  expiresAt: Date;
  characters: Parameters<typeof mplusCharacterDTO>[0][];
  positions: Parameters<typeof mplusPositionDTO>[0][];
}): MPlusRecruitmentPostDTO {
  return {
    id: p.id,
    ownerUserId: p.ownerUserId,
    postType: p.postType,
    title: p.title,
    description: p.description,
    teamName: p.teamName,
    region: p.region,
    country: p.country,
    languages: parseStringArray(p.languages),
    timeZone: p.timeZone,
    availability: parseAvailability(p.availability),
    goal: p.goal,
    currentKeyMin: p.currentKeyMin,
    currentKeyMax: p.currentKeyMax,
    targetKeyMin: p.targetKeyMin,
    targetKeyMax: p.targetKeyMax,
    voiceRequired: p.voiceRequired,
    voicePlatform: p.voicePlatform,
    teamMaturity: p.teamMaturity,
    atmosphere: p.atmosphere,
    showLogs: p.showLogs,
    showProfile: p.showProfile,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    refreshedAt: p.refreshedAt.toISOString(),
    expiresAt: p.expiresAt.toISOString(),
    characters: p.characters.map(mplusCharacterDTO),
    // Highest priority first, then the order they were created in.
    positions: p.positions.map(mplusPositionDTO).sort((a, b) => b.priority - a.priority),
  };
}

// ---------------------------------------------------------------------------
// Guilds
// ---------------------------------------------------------------------------

export function guildSummaryDTO(g: {
  id: string;
  name: string;
  region: string;
  country: string | null;
  realm: string | null;
  realmSlug: string | null;
  faction: string | null;
  languages: string;
}): GuildSummaryDTO {
  return {
    id: g.id,
    name: g.name,
    region: g.region,
    country: g.country,
    realm: g.realm,
    realmSlug: g.realmSlug,
    faction: g.faction,
    languages: parseStringArray(g.languages),
  };
}

export function raidPositionDTO(p: {
  id: string;
  role: string;
  preferredSpecIds: string;
  acceptedSpecIds: string;
  recruitmentType: string;
  priority: number;
  isFilled: boolean;
}): RaidRecruitmentPositionDTO {
  return {
    id: p.id,
    role: p.role,
    preferredSpecIds: parseStringArray(p.preferredSpecIds),
    acceptedSpecIds: parseStringArray(p.acceptedSpecIds),
    recruitmentType: p.recruitmentType,
    priority: p.priority,
    isFilled: p.isFilled,
  };
}

export function raidTeamDTO(t: {
  id: string;
  guildId: string;
  name: string;
  difficulty: string;
  currentProgression: string | null;
  currentRaidId: string | null;
  currentBossesKilled: number | null;
  previousProgression: string | null;
  availability: string;
  timeZone: string | null;
  voicePlatform: string | null;
  attendanceRequirement: number | null;
  trialDuration: string | null;
  benchPolicy: string | null;
  lootPolicy: string | null;
  expectations: string | null;
  requiredAddons: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  refreshedAt: Date;
  expiresAt: Date;
  positions: Parameters<typeof raidPositionDTO>[0][];
  guild?: Parameters<typeof guildSummaryDTO>[0] | null;
}): RaidTeamDTO {
  return {
    id: t.id,
    guildId: t.guildId,
    name: t.name,
    difficulty: t.difficulty,
    currentProgression: t.currentProgression,
    currentRaidId: t.currentRaidId,
    currentBossesKilled: t.currentBossesKilled,
    previousProgression: t.previousProgression,
    availability: parseAvailability(t.availability),
    timeZone: t.timeZone,
    voicePlatform: t.voicePlatform,
    attendanceRequirement: t.attendanceRequirement,
    trialDuration: t.trialDuration,
    benchPolicy: t.benchPolicy,
    lootPolicy: t.lootPolicy,
    expectations: t.expectations,
    requiredAddons: parseStringArray(t.requiredAddons),
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    refreshedAt: t.refreshedAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    positions: t.positions.map(raidPositionDTO).sort((a, b) => b.priority - a.priority),
    ...(t.guild ? { guild: guildSummaryDTO(t.guild) } : {}),
  };
}

export function guildDTO(g: Parameters<typeof guildSummaryDTO>[0] & {
  ownerUserId: string;
  description: string | null;
  culture: string | null;
  size: number | null;
  discordUrl: string | null;
  websiteUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  raidTeams: Parameters<typeof raidTeamDTO>[0][];
}): GuildDTO {
  return {
    ...guildSummaryDTO(g),
    ownerUserId: g.ownerUserId,
    description: g.description,
    culture: g.culture,
    size: g.size,
    discordUrl: g.discordUrl,
    websiteUrl: g.websiteUrl,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    raidTeams: g.raidTeams.map(raidTeamDTO),
  };
}

export function raiderProfileDTO(r: {
  id: string;
  ownerUserId: string;
  characterId: string;
  primarySpecId: string;
  alternateSpecIds: string;
  preferredRole: string;
  offRoles: string;
  title: string | null;
  introduction: string | null;
  region: string;
  country: string | null;
  languages: string;
  timeZone: string | null;
  availability: string;
  preferredDifficulty: string;
  currentProgression: string | null;
  previousProgression: string | null;
  bossExperience: string;
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
  createdAt: Date;
  updatedAt: Date;
  refreshedAt: Date;
  expiresAt: Date;
  character: CharRow;
}): RaiderProfileDTO {
  return {
    id: r.id,
    ownerUserId: r.ownerUserId,
    characterId: r.characterId,
    primarySpecId: r.primarySpecId,
    alternateSpecIds: parseStringArray(r.alternateSpecIds),
    preferredRole: r.preferredRole,
    offRoles: parseStringArray(r.offRoles),
    title: r.title,
    introduction: r.introduction,
    region: r.region,
    country: r.country,
    languages: parseStringArray(r.languages),
    timeZone: r.timeZone,
    availability: parseAvailability(r.availability),
    preferredDifficulty: r.preferredDifficulty,
    currentProgression: r.currentProgression,
    previousProgression: r.previousProgression,
    bossExperience: parseBossExperience(r.bossExperience),
    attendanceExpectation: r.attendanceExpectation,
    voiceAvailable: r.voiceAvailable,
    transferWilling: r.transferWilling,
    factionFlexible: r.factionFlexible,
    atmosphere: r.atmosphere,
    competitiveLevel: r.competitiveLevel,
    trialAvailable: r.trialAvailable,
    showLogs: r.showLogs,
    showProfile: r.showProfile,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    refreshedAt: r.refreshedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    character: charDTO(r.character),
  };
}

/** Seeds a raider profile's per-boss detail from the kill data we already sync
 * onto the character (Character.raidKills). Gives a new profile something real
 * to show before the raider hand-edits phases and pull dates, rather than an
 * empty progression section. */
export function bossExperienceFromRaidKills(raidKillsJson: string): BossExperience[] {
  try {
    const v = JSON.parse(raidKillsJson);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x) =>
          x &&
          typeof x.raidId === "string" &&
          typeof x.bossId === "string" &&
          DIFFICULTIES.has(x.difficulty) // raidKills also carries "lfr", which has no recruitment meaning
      )
      .map((x) => ({
        raidId: x.raidId,
        bossId: x.bossId,
        difficulty: x.difficulty as RaidDifficulty,
        state: "killed" as const,
      }));
  } catch {
    return [];
  }
}
