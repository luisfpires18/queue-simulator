// Fake test data — a seeded local user with a few characters, so you can
// exercise List-a-key/Apply/Characters-board flows without your real
// Battle.net account. This user can't sign in via real Battle.net OAuth
// (Blizzard controls that) — use the dev-login bypass instead (see
// src/auth.ts, gated behind ALLOW_DEV_LOGIN=1 in .env, never available in
// production). Safe to re-run: everything is upserted, not duplicated.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FAKE_BNET_ID = "dev-fake-1";

async function main() {
  const user = await prisma.user.upsert({
    where: { bnetId: FAKE_BNET_ID },
    create: { bnetId: FAKE_BNET_ID, battletag: "TestHero#1111" },
    update: { battletag: "TestHero#1111" },
  });

  const characters = [
    { name: "Testytank", classId: "paladin", specId: "paladin:protection", level: 80, ilvl: 620, rating: 2400, isMain: true, bucket: "main" as const },
    { name: "Testyheal", classId: "druid", specId: "druid:restoration", level: 80, ilvl: 615, rating: 2100, isMain: false, bucket: "main" as const },
    { name: "Testymage", classId: "mage", specId: "mage:frost", level: 80, ilvl: 605, rating: 1950, isMain: false, bucket: "alt" as const },
    { name: "Testyhunter", classId: "hunter", specId: "hunter:beastmastery", level: 80, ilvl: 590, rating: 1600, isMain: false, bucket: "alt" as const },
    { name: "Testysecret", classId: "demonhunter", specId: "demonhunter:havoc", level: 80, ilvl: 580, rating: 1400, isMain: false, bucket: "hidden" as const },
  ];

  for (const [i, c] of characters.entries()) {
    await prisma.character.upsert({
      where: { userId_realm_name: { userId: user.id, realm: "Khadgar", name: c.name } },
      create: {
        userId: user.id,
        name: c.name,
        realm: "Khadgar",
        realmSlug: "khadgar",
        region: "eu",
        classId: c.classId,
        specId: c.specId,
        level: c.level,
        ilvl: c.ilvl,
        rating: c.rating,
        faction: "Alliance",
        isMain: c.isMain,
        bucket: c.bucket,
        sortOrder: i,
      },
      update: {
        classId: c.classId,
        specId: c.specId,
        level: c.level,
        ilvl: c.ilvl,
        rating: c.rating,
        isMain: c.isMain,
        bucket: c.bucket,
      },
    });
  }

  console.log(`Seeded fake user ${FAKE_BNET_ID} (${user.battletag}) with ${characters.length} characters.`);

  await seedRecruitment(user.id);
}

/** Recruitment and guild listings, owned by a SECOND fake account.
 *
 * Deliberately not owned by the primary seed user: you cannot apply to your
 * own listing, so a board full of your own posts is impossible to exercise.
 * With these owned by someone else, signing in as dev-fake-1 gives you
 * something to actually apply to. */
async function seedRecruitment(primaryUserId: string) {
  const other = await prisma.user.upsert({
    where: { bnetId: "dev-fake-recruiter" },
    create: { bnetId: "dev-fake-recruiter", battletag: "GuildLead#2222" },
    update: { battletag: "GuildLead#2222" },
  });

  const recruiterChar = await prisma.character.upsert({
    where: { userId_realm_name: { userId: other.id, realm: "Khadgar", name: "Leadytank" } },
    create: {
      userId: other.id, name: "Leadytank", realm: "Khadgar", realmSlug: "khadgar", region: "eu",
      classId: "warrior", specId: "warrior:protection", level: 80, ilvl: 625, rating: 2800,
      isMain: true, bucket: "main",
    },
    update: {},
  });

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // Tue/Thu 20:00-23:00 - minutes since midnight, see src/game/availability.ts.
  const evenings = JSON.stringify([
    { day: 2, startMin: 1200, endMin: 1380 },
    { day: 4, startMin: 1200, endMin: 1380 },
  ]);

  // Stable ids so re-running updates these rows instead of piling up copies
  // (there is no natural unique key on a recruitment post).
  const TEAM_POST_ID = "seed-mplus-team";
  const PLAYER_POST_ID = "seed-mplus-player";
  const GUILD_ID = "seed-guild";
  const RAID_TEAM_ID = "seed-raid-team";
  const RAIDER_PROFILE_ID = "seed-raider";

  await prisma.mPlusRecruitmentPost.upsert({
    where: { id: TEAM_POST_ID },
    update: {},
    create: {
      id: TEAM_POST_ID,
      ownerUserId: other.id,
      postType: "team_lfp",
      title: "Pushing to +23, need a healer",
      teamName: "Tuesday Push Crew",
      description: "Chill but focused. We time everything in range before pushing. Discord required.",
      region: "eu",
      languages: JSON.stringify(["en", "pt"]),
      timeZone: "Europe/Lisbon",
      availability: evenings,
      goal: "push",
      currentKeyMin: 18, currentKeyMax: 22,
      targetKeyMin: 23, targetKeyMax: 25,
      voiceRequired: true, voicePlatform: "discord",
      teamMaturity: "established", atmosphere: "focused",
      refreshedAt: now, expiresAt: in14Days,
      characters: {
        create: [{
          characterId: recruiterChar.id,
          primarySpecId: "warrior:protection",
          preferredRole: "TANK",
          isMain: true, isCurrentMember: true, teamRole: "leader",
        }],
      },
      positions: {
        create: [
          { role: "HEALER", preferredSpecIds: JSON.stringify(["paladin:holy", "druid:restoration"]), acceptedSpecIds: "[]", priority: 1 },
          { role: "DPS", preferredSpecIds: "[]", acceptedSpecIds: "[]", isPermanent: false },
        ],
      },
    },
  });

  await prisma.mPlusRecruitmentPost.upsert({
    where: { id: PLAYER_POST_ID },
    update: {},
    create: {
      id: PLAYER_POST_ID,
      ownerUserId: other.id,
      postType: "player_lft",
      title: "Prot Warrior looking for a weekly team",
      description: "Free most evenings. Happy to route and lead pulls.",
      region: "eu",
      languages: JSON.stringify(["en"]),
      timeZone: "Europe/Lisbon",
      availability: evenings,
      goal: "vault",
      currentKeyMin: 16, currentKeyMax: 20,
      atmosphere: "chill",
      refreshedAt: now, expiresAt: in14Days,
      characters: {
        create: [{
          characterId: recruiterChar.id,
          primarySpecId: "warrior:protection",
          alternateSpecIds: JSON.stringify(["warrior:fury"]),
          preferredRole: "TANK",
          willingRoles: JSON.stringify(["TANK", "DPS"]),
          isMain: true,
        }],
      },
    },
  });

  await prisma.guild.upsert({
    where: { id: GUILD_ID },
    update: {},
    create: {
      id: GUILD_ID,
      ownerUserId: other.id,
      name: "Seed Raiders",
      region: "eu", realm: "Khadgar", realmSlug: "khadgar", faction: "Alliance",
      description: "Long-running Heroic guild moving into Mythic this tier.",
      culture: "Adults with jobs. We joke a lot and still kill bosses.",
      size: 42,
      languages: JSON.stringify(["en"]),
      raidTeams: {
        create: [{
          id: RAID_TEAM_ID,
          name: "Main raid",
          difficulty: "mythic",
          currentProgression: "4/8 M",
          currentBossesKilled: 4,
          previousProgression: "8/8 H",
          availability: evenings,
          timeZone: "Europe/Lisbon",
          voicePlatform: "discord",
          attendanceRequirement: 85,
          trialDuration: "2 weeks",
          lootPolicy: "Loot council, need over greed",
          benchPolicy: "Rotating, everyone raids",
          expectations: "Know your class, watch the pull video, show up on time.",
          requiredAddons: JSON.stringify(["WeakAuras", "MRT"]),
          refreshedAt: now, expiresAt: in30Days,
          positions: {
            create: [
              { role: "HEALER", preferredSpecIds: JSON.stringify(["paladin:holy"]), acceptedSpecIds: "[]", recruitmentType: "core", priority: 1 },
              { role: "DPS", preferredSpecIds: "[]", acceptedSpecIds: "[]", recruitmentType: "trial" },
              { role: "TANK", preferredSpecIds: "[]", acceptedSpecIds: "[]", recruitmentType: "core", priority: -1 },
            ],
          },
        }],
      },
    },
  });

  // A raider profile on the PRIMARY user's alt, so the Raiders board is not
  // empty and the primary account has one of its own listings to manage.
  const alt = await prisma.character.findFirst({
    where: { userId: primaryUserId, name: "Testyheal" },
  });
  if (alt) {
    await prisma.raiderProfile.upsert({
      where: { id: RAIDER_PROFILE_ID },
      update: {},
      create: {
        id: RAIDER_PROFILE_ID,
        ownerUserId: primaryUserId,
        characterId: alt.id,
        primarySpecId: "druid:restoration",
        alternateSpecIds: JSON.stringify(["druid:balance"]),
        preferredRole: "HEALER",
        offRoles: JSON.stringify(["DPS"]),
        title: "Resto Druid looking for a Mythic team",
        introduction: "Raided Heroic all of last tier, want to push Mythic this one.",
        region: "eu",
        languages: JSON.stringify(["en", "pt"]),
        timeZone: "Europe/Lisbon",
        availability: evenings,
        preferredDifficulty: "mythic",
        currentProgression: "8/8 H, 2/8 M",
        previousProgression: "8/8 H",
        attendanceExpectation: 90,
        atmosphere: "focused",
        competitiveLevel: "semi_hardcore",
        refreshedAt: now, expiresAt: in30Days,
      },
    });
  }

  console.log("Seeded recruitment: 2 M+ posts, 1 guild + raid team, 1 raider profile.");
}

main().finally(() => prisma.$disconnect());
