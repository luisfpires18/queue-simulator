// The app's data-transfer shapes: what the data layer returns to pages, API
// routes, and client components. Types only - no runtime imports - so client
// bundles can `import type` from here without dragging in Prisma. The
// runtime lives in the sibling modules (users/characters/groups/
// applications/soloQueue), each of which maps Prisma rows into these shapes
// via src/data/mappers.ts.
import type { RaidKillDifficulty } from "@/game/raidSeason";

export interface CharacterDTO {
  id: string;
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  specId: string | null;
  level: number;
  ilvl: number | null;
  rating: number | null;
  faction: string;
  isMain: boolean;
  bucket: string; // "main" | "alt" | "hidden"
  sortOrder: number;
  wclZone: string | null;
  raidKills: RaidKillDTO[];
  /** Aggregate mythic-boss count from raider.io, used only when raidKills is
   * empty (most commonly: this character's Warcraft Logs are private - see
   * RaidBossGrid's doc comment). No per-boss detail. */
  raidProgressFallback?: { killed: number; total: number } | null;
}

/** One boss at the highest difficulty ever killed - no parse/percentile, just
 * kill/no-kill + difficulty (see src/game/raidSeason.ts). One entry per boss. */
export interface RaidKillDTO {
  raidId: string;
  bossId: string;
  difficulty: RaidKillDifficulty;
}

/** One spec's best run on one dungeon this season — sourced from raider.io's
 * public API (see fetchRaiderIoRating in src/data/raiderio.ts). */
export interface DungeonBestRun {
  dungeonId: number;
  dungeonName: string;
  level: number;
  score: number;
  timed: boolean | null;
  completedAt: number | null; // epoch ms
}

export interface SpecTrackDTO {
  id: string;
  characterId: string;
  specId: string;
  role: string;
  points: number | null;
  bnetScore: number | null;
  isMain: boolean;
  bestRuns: DungeonBestRun[];
}

/** A character plus its tracked specs — the shape forms (List a key, Apply) build pickers from. */
export type RosterCharacterDTO = CharacterDTO & { specTracks: SpecTrackDTO[] };

/** The navbar's globally-selected character + spec — who List-a-key/Apply act as. */
export interface CurrentSelectionDTO {
  character: RosterCharacterDTO;
  specId: string;
}

export interface OpenSlot {
  role: string; // TANK | HEALER | DPS
  prefs: string[]; // ordered acceptable specIds (combo)
}

/** One member of a whole pre-made-group bundle (see Group.combos). */
export interface ComboMember {
  role: string; // TANK | HEALER | DPS
  specId: string;
}

export interface GroupDTO {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  route: string | null; // Mythic Dungeon Tools route (kind="mplus" only)
  kind: string; // "mplus" | "raid"
  dungeonId: string | null; // kind="mplus"
  keyLevel: number | null; // kind="mplus"
  raidId: string | null; // kind="raid"
  raidDifficulty: string | null; // kind="raid"
  raidSize: number | null; // kind="raid"
  ownerRole: string;
  startsAt: string | null; // null = forming now / ASAP
  slots: OpenSlot[];
  combos: ComboMember[][];
  // applicant requirement (optional, advisory only - see src/game/achievements.ts)
  requirementType: string | null; // "rating" | "resilient" | "custom"
  reqRating: number | null;
  reqLevel: number | null;
  reqExtraCount: number | null;
  reqExtraLevel: number | null;
  status: string;
  createdAt: string;
  members: (CharacterDTO & { role: string; slot: number; broughtSpecId: string | null; userId: string })[];
}

export interface CharacterRatingSummaryDTO {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  ilvl: number | null;
  specTracks: SpecTrackDTO[]; // every tracked spec, not just the one being viewed — lets the caller compare main vs. off spec
  raidKills: RaidKillDTO[];
  /** ISO 3166-1 alpha-2, from the owning account's Settings tab (User.country)
   * — same flag shown on the public profile page (ProfileOverview). Null if
   * the owner never set one, same as everywhere else that shows it. */
  country: string | null;
}

export interface CreateGroupInput {
  title: string;
  description?: string | null;
  route?: string | null; // Mythic Dungeon Tools route (kind="mplus" only)
  kind?: string; // "mplus" (default) | "raid"
  dungeonId?: string | null; // kind="mplus"
  keyLevel?: number | null; // kind="mplus"
  raidId?: string | null; // kind="raid"
  raidDifficulty?: string | null; // kind="raid"
  raidSize?: number | null; // kind="raid"
  ownerRole: string;
  ownerCharacterId: string;
  ownerSpecId: string;
  startsAt?: string | null;
  slots: OpenSlot[];
  combos?: ComboMember[][];
  requirementType?: string | null;
  reqRating?: number | null;
  reqLevel?: number | null;
  reqExtraCount?: number | null;
  reqExtraLevel?: number | null;
}

export interface ActiveCommitmentDTO {
  groupId: string;
  title: string;
  startsAt: string | null;
}

export interface ApplicationDTO {
  id: string;
  groupId: string;
  applicantUserId: string;
  characterId: string;
  characterName: string;
  characterRealm: string;
  characterRealmSlug: string;
  characterRegion: string;
  classId: string;
  characterIlvl: number | null;
  characterRaidKills: RaidKillDTO[];
  role: string;
  specId: string;
  note: string | null;
  route: string | null; // applicant's proposed MDT route - only ever set for TANK on mplus
  status: string; // pending | accepted | declined
  source: string; // manual | queue — see Application.source in schema.prisma
  createdAt: string;
}

/** The viewer's own application state for one group - what the Apply button
 * renders from. Shape of GET /api/groups/[id]/my-application. */
export interface MyApplicationStateDTO {
  application: ApplicationDTO | null;
  declinedCount: number;
}

export interface ApplyInput {
  groupId: string;
  characterId: string;
  specId: string;
  role: string;
  note?: string | null;
  route?: string | null;
}

export interface ApplicationWithRatingDTO extends ApplicationDTO {
  specTracks: SpecTrackDTO[]; // every tracked spec on the applicant's character — lets the UI compare main vs. the spec they applied with
  rankedByMain: boolean; // sort position driven by their main spec's (higher) score, not the spec they're actually applying with
  meetsRequirement: boolean | null; // null = the listing has no requirement; advisory only, never gates /apply
}

export type AcceptApplicationResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; conflictTitle: string }
  | { ok: false; reason: "below_requirement"; requiredRating: number };

export interface SoloQueueStatusDTO {
  status: "idle" | "queued" | "matched";
  groupId: string | null;
}

export interface JoinSoloQueueInput {
  characterId: string;
  role: string;
  specId: string;
  // Optional match filters, mirroring the board's own filter sidebar - see
  // QueueEntry in src/game/soloQueue.ts.
  minKeyLevel?: number | null;
  maxKeyLevel?: number | null;
  dungeonIds?: string[];
}
