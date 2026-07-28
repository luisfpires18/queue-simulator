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
  /** Set only when the latest application was declined - the reason the owner
   * picked, shown on the card and in the apply modal so the applicant doesn't
   * have to dig through their profile to find out why. */
  lastDecline: LastDeclineDTO | null;
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

// ---- Decline reasons + history ----

export interface DeclineReasonDTO {
  id: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

/** What the applicant is shown about why they were turned down - the reason
 * plus the decliner's note, attached to the listing it belongs to. */
export interface LastDeclineDTO {
  reasonLabel: string;
  note: string | null;
  createdAt: string;
}

/** Declining fails only two ways: the application isn't yours/isn't pending,
 * or the picked reason doesn't exist or has been archived. */
export type DeclineResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_reason" };

/** One decline, as shown on either side of it. Every display field is frozen
 * at decline time (see the DeclineRecord model) - renaming a reason or
 * deleting the character never rewrites what happened. */
export interface DeclineRecordDTO {
  id: string;
  listingKind: string; // "mplus" | "raid" | "team"
  listingTitle: string;
  listingId: string;
  reasonLabel: string;
  note: string | null;
  characterName: string;
  characterRealm: string;
  classId: string;
  role: string;
  specId: string;
  createdAt: string;
  /** The other party: who declined you, or who you declined. */
  counterparty: DisplayIdentityDTO;
}

// ---- Teams (persistent rosters, listed on /teams) ----

export interface TeamMemberDTO {
  userId: string;
  characterId: string;
  characterName: string;
  characterRealm: string;
  characterRealmSlug: string;
  characterRegion: string;
  classId: string;
  characterIlvl: number | null;
  characterRating: number | null;
  role: string;
  specId: string | null;
  isOwner: boolean;
  joinedAt: string;
}

export interface TeamDTO {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  iconSlug: string;
  /** ISO 639-1 from src/game/languages.ts - what voice chat is spoken in. */
  language: string | null;
  /** Free text, e.g. "Discord, mic required". Null renders nothing. */
  voiceChat: string | null;
  // Same advisory requirement vocabulary as GroupDTO.
  requirementType: string | null;
  reqRating: number | null;
  reqLevel: number | null;
  reqExtraCount: number | null;
  reqExtraLevel: number | null;
  slots: OpenSlot[]; // open recruitment slots
  status: string;
  createdAt: string;
  members: TeamMemberDTO[];
}

/** The compact form the profile status chip renders from. */
export interface TeamSummaryDTO {
  id: string;
  name: string;
  iconSlug: string;
  memberCount: number;
}

export interface CreateTeamInput {
  name: string;
  description?: string | null;
  iconSlug: string;
  language?: string | null;
  voiceChat?: string | null;
  ownerRole: string;
  ownerCharacterId: string;
  ownerSpecId: string;
  slots: OpenSlot[];
  requirementType?: string | null;
  reqRating?: number | null;
  reqLevel?: number | null;
  reqExtraCount?: number | null;
  reqExtraLevel?: number | null;
}

export interface TeamApplicationDTO {
  id: string;
  teamId: string;
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
  status: string; // pending | accepted | declined
  createdAt: string;
}

export interface TeamApplicationWithRatingDTO extends TeamApplicationDTO {
  specTracks: SpecTrackDTO[];
  rankedByMain: boolean;
  meetsRequirement: boolean | null;
}

/** Shape of GET /api/teams/[id]/my-application - drives the Apply button. */
export interface MyTeamApplicationStateDTO {
  application: TeamApplicationDTO | null;
  /** See MyApplicationStateDTO.lastDecline. */
  lastDecline: LastDeclineDTO | null;
  /** Counted from DeclineRecord rather than the application row, which a
   * re-apply overwrites - same two-attempt cap as a key listing. */
  declinedCount: number;
}

export interface ApplyToTeamInput {
  teamId: string;
  characterId: string;
  specId: string;
  role: string;
  note?: string | null;
}

export type AcceptTeamApplicationResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_in_team" }
  | { ok: false; reason: "below_requirement"; requiredRating: number };

export type TeamActionResult = { ok: true } | { ok: false; reason: "not_found" | "not_allowed" | "owner_must_delist" };

/** A user's "who they are" on a friend card — derived from their main (or
 * first) character, since this app has no usernames. Null fields mean the
 * user has no characters synced yet. */
export interface DisplayIdentityDTO {
  battletag: string | null;
  characterName: string | null;
  characterRealm: string | null;
  characterRealmSlug: string | null;
  region: string | null;
  classId: string | null;
  level: number | null;
  faction: string | null;
}

export type FriendshipStatus = "none" | "friends" | "pending_outgoing" | "pending_incoming";

export interface FriendRequestDTO {
  id: string;
  requesterUserId: string;
  addresseeUserId: string;
  status: string; // pending | accepted | declined
  createdAt: string;
  requester: DisplayIdentityDTO;
  addressee: DisplayIdentityDTO;
}

export type SendFriendRequestResult =
  | { ok: true; request: FriendRequestDTO }
  | { ok: false; reason: "self" | "already_friends" | "already_pending" };

/** One row of the caller's friends list — `userId` is the OTHER person. */
export interface FriendDTO {
  userId: string;
  friendRequestId: string;
  since: string;
  identity: DisplayIdentityDTO;
  unreadCount: number;
  /** Whether this friend has an open Network SSE connection right now — see
   * networkBroadcaster.isOnline. A per-process presence signal, not a durable
   * "last seen" record. */
  online: boolean;
}

export interface MessageDTO {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface ChatGroupMemberDTO {
  userId: string;
  identity: DisplayIdentityDTO;
  isOwner: boolean;
  joinedAt: string;
  /** Relative to the VIEWER (not the owner) — drives the "Add Friend"
   * affordance for co-members who aren't mutual friends yet. */
  friendshipStatus: FriendshipStatus;
}

export interface ChatGroupSummaryDTO {
  id: string;
  name: string;
  ownerUserId: string;
  memberCount: number;
  unreadCount: number;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
}

export interface ChatGroupDTO extends ChatGroupSummaryDTO {
  members: ChatGroupMemberDTO[];
  isOwner: boolean;
}

export interface ChatGroupMessageDTO {
  id: string;
  chatGroupId: string;
  senderId: string;
  senderIdentity: DisplayIdentityDTO;
  body: string;
  createdAt: string;
}

export type CreateChatGroupResult =
  | { ok: true; group: ChatGroupDTO }
  | { ok: false; reason: "not_friends" | "empty_name" | "no_members" | "too_many_members" };

export type ChatGroupActionResult = { ok: true } | { ok: false; reason: "not_owner" | "not_friends" | "not_found" };

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

/** A currently-live Twitch stream, for the public profile's preview card
 * (see src/data/twitch.ts). Null (not this type) means offline/unconfigured/
 * lookup failed - the profile just falls back to a plain link either way. */
export interface TwitchLiveInfoDTO {
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
}

/** One row of the admin Feature Flags panel — registry metadata (label/
 * description) merged with the flag's current on/off state. */
export interface FeatureFlagStateDTO {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}
