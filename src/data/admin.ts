// Read models for the admin dashboard: counts, recent activity, and the user
// list. Kept out of the feature-flag module because none of this decides
// access - it only reports on what exists.
import { prisma } from "@/lib/prisma";
import { FEATURES } from "@/game/features";

export interface AdminStats {
  users: number;
  characters: number;
  mplusPosts: number;
  guilds: number;
  raidTeams: number;
  raiderProfiles: number;
  applications: number;
  openReports: number;
  groups: number;
  runs: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  // One round trip rather than ten sequential awaits.
  const [
    users,
    characters,
    mplusPosts,
    guilds,
    raidTeams,
    raiderProfiles,
    applications,
    openReports,
    groups,
    runs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.character.count(),
    prisma.mPlusRecruitmentPost.count(),
    prisma.guild.count(),
    prisma.raidTeam.count(),
    prisma.raiderProfile.count(),
    prisma.recruitmentApplication.count(),
    prisma.report.count({ where: { status: "open" } }),
    prisma.group.count(),
    prisma.run.count(),
  ]);

  return {
    users, characters, mplusPosts, guilds, raidTeams,
    raiderProfiles, applications, openReports, groups, runs,
  };
}

export interface RecentActivity {
  users: { bnetId: string; battletag: string | null; createdAt: string }[];
  posts: { id: string; title: string; createdAt: string }[];
}

export async function getRecentActivity(limit = 5): Promise<RecentActivity> {
  const [users, posts] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { bnetId: true, battletag: true, createdAt: true },
    }),
    prisma.mPlusRecruitmentPost.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, teamName: true, createdAt: true },
    }),
  ]);

  return {
    users: users.map((u) => ({
      bnetId: u.bnetId,
      battletag: u.battletag,
      createdAt: u.createdAt.toISOString(),
    })),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.teamName || p.title,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export interface AdminUserRow {
  id: string;
  bnetId: string;
  battletag: string | null;
  country: string | null;
  createdAt: string;
  characterCount: number;
  /** Recruitment posts + guilds + raider profiles they own. */
  listingCount: number;
  applicationCount: number;
  /** Feature keys this account has been granted, by bnetId. */
  grants: string[];
  /** How many people they have blocked - a rough abuse signal. */
  blocksMade: number;
}

/** The Users tab. Searchable by battletag or bnetId.
 *
 * Grants are looked up by bnetId in one batched query rather than per row -
 * FeatureAccess has no relation to User (it is keyed by bnetId precisely so an
 * invite can precede a signup), so this cannot be a join. */
export async function listAdminUsers(
  opts: { search?: string; limit?: number } = {}
): Promise<AdminUserRow[]> {
  const search = opts.search?.trim();

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { battletag: { contains: search } },
            { bnetId: { contains: search } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    select: {
      id: true,
      bnetId: true,
      battletag: true,
      country: true,
      createdAt: true,
      _count: {
        select: {
          characters: true,
          mplusRecruitmentPosts: true,
          guilds: true,
          raiderProfiles: true,
          recruitmentApplications: true,
          blocksMade: true,
        },
      },
    },
  });
  if (!users.length) return [];

  const grantRows = await prisma.featureAccess.findMany({
    where: { bnetId: { in: users.map((u) => u.bnetId) } },
    select: { bnetId: true, featureId: true },
  });
  const grantsByBnetId = new Map<string, string[]>();
  for (const g of grantRows) {
    const list = grantsByBnetId.get(g.bnetId) ?? [];
    list.push(g.featureId);
    grantsByBnetId.set(g.bnetId, list);
  }

  return users.map((u) => ({
    id: u.id,
    bnetId: u.bnetId,
    battletag: u.battletag,
    country: u.country,
    createdAt: u.createdAt.toISOString(),
    characterCount: u._count.characters,
    listingCount:
      u._count.mplusRecruitmentPosts + u._count.guilds + u._count.raiderProfiles,
    applicationCount: u._count.recruitmentApplications,
    grants: grantsByBnetId.get(u.bnetId) ?? [],
    blocksMade: u._count.blocksMade,
  }));
}

/** Feature keys, for the Users tab's grant chips. */
export const FEATURE_KEYS = FEATURES.map((f) => f.key);
