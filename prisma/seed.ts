// Fake test data — several seeded local users with characters, friendships,
// DMs, and a Team Group, so you can exercise Network (friend requests, chat,
// group chat, presence) and LFG (List/Apply) flows without real Battle.net
// accounts. These users can't sign in via real Battle.net OAuth (Blizzard
// controls that) — use the dev-login bypass instead (see src/auth.ts, gated
// behind ALLOW_DEV_LOGIN=1 in .env, never available in production). Safe to
// re-run: everything is upserted or existence-checked, never duplicated.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FakeCharacter {
  name: string;
  classId: string;
  specId: string;
  level: number;
  ilvl: number;
  rating: number;
  isMain: boolean;
  bucket: "main" | "alt" | "hidden";
  realm: string;
  realmSlug: string;
}

interface FakeUser {
  bnetId: string;
  battletag: string;
  faction: "Alliance" | "Horde";
  characters: FakeCharacter[];
}

const USERS: FakeUser[] = [
  {
    bnetId: "dev-fake-1",
    battletag: "TestHero#1111",
    faction: "Alliance",
    characters: [
      { name: "Testytank", classId: "paladin", specId: "paladin:protection", level: 80, ilvl: 620, rating: 2400, isMain: true, bucket: "main", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Testyheal", classId: "druid", specId: "druid:restoration", level: 80, ilvl: 615, rating: 2100, isMain: false, bucket: "main", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Testymage", classId: "mage", specId: "mage:frost", level: 80, ilvl: 605, rating: 1950, isMain: false, bucket: "alt", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Testyhunter", classId: "hunter", specId: "hunter:beastmastery", level: 80, ilvl: 590, rating: 1600, isMain: false, bucket: "alt", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Testysecret", classId: "demonhunter", specId: "demonhunter:havoc", level: 80, ilvl: 580, rating: 1400, isMain: false, bucket: "hidden", realm: "Khadgar", realmSlug: "khadgar" },
    ],
  },
  {
    bnetId: "dev-fake-2",
    battletag: "Shadowbrew#2222",
    faction: "Horde",
    characters: [
      { name: "Shadowbrew", classId: "rogue", specId: "rogue:assassination", level: 80, ilvl: 610, rating: 2200, isMain: true, bucket: "main", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Shadowtank", classId: "warrior", specId: "warrior:protection", level: 80, ilvl: 600, rating: 1900, isMain: false, bucket: "alt", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Shadowpriest", classId: "priest", specId: "priest:shadow", level: 80, ilvl: 595, rating: 1800, isMain: false, bucket: "alt", realm: "Khadgar", realmSlug: "khadgar" },
    ],
  },
  {
    bnetId: "dev-fake-3",
    battletag: "Lunastrike#3333",
    faction: "Alliance",
    characters: [
      { name: "Lunastrike", classId: "hunter", specId: "hunter:marksmanship", level: 80, ilvl: 590, rating: 1750, isMain: true, bucket: "main", realm: "Aggra", realmSlug: "aggra" },
      { name: "Lunadruid", classId: "druid", specId: "druid:balance", level: 80, ilvl: 580, rating: 1650, isMain: false, bucket: "alt", realm: "Aggra", realmSlug: "aggra" },
    ],
  },
  {
    bnetId: "dev-fake-4",
    battletag: "Ironclad#4444",
    faction: "Horde",
    characters: [
      { name: "Ironclad", classId: "warrior", specId: "warrior:protection", level: 80, ilvl: 625, rating: 2500, isMain: true, bucket: "main", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Ironpala", classId: "paladin", specId: "paladin:retribution", level: 80, ilvl: 605, rating: 2000, isMain: false, bucket: "alt", realm: "Khadgar", realmSlug: "khadgar" },
      { name: "Ironmonk", classId: "monk", specId: "monk:mistweaver", level: 80, ilvl: 595, rating: 1850, isMain: false, bucket: "alt", realm: "Khadgar", realmSlug: "khadgar" },
    ],
  },
  {
    bnetId: "dev-fake-5",
    battletag: "Emberfall#5555",
    faction: "Alliance",
    characters: [
      { name: "Emberfall", classId: "mage", specId: "mage:fire", level: 80, ilvl: 570, rating: 1500, isMain: true, bucket: "main", realm: "Silvermoon City", realmSlug: "silvermoon-city" },
    ],
  },
  {
    bnetId: "dev-fake-6",
    battletag: "Nightshade#6666",
    faction: "Horde",
    characters: [
      { name: "Nightshade", classId: "warlock", specId: "warlock:affliction", level: 80, ilvl: 588, rating: 1700, isMain: true, bucket: "main", realm: "Silvermoon City", realmSlug: "silvermoon-city" },
      { name: "Nightdk", classId: "deathknight", specId: "deathknight:frost", level: 80, ilvl: 578, rating: 1600, isMain: false, bucket: "alt", realm: "Silvermoon City", realmSlug: "silvermoon-city" },
    ],
  },
];

async function seedUsers(): Promise<Map<string, string>> {
  const idByBnetId = new Map<string, string>();

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { bnetId: u.bnetId },
      create: { bnetId: u.bnetId, battletag: u.battletag },
      update: { battletag: u.battletag },
    });
    idByBnetId.set(u.bnetId, user.id);

    for (const [i, c] of u.characters.entries()) {
      await prisma.character.upsert({
        where: { userId_realm_name: { userId: user.id, realm: c.realm, name: c.name } },
        create: {
          userId: user.id, name: c.name, realm: c.realm, realmSlug: c.realmSlug, region: "eu",
          classId: c.classId, specId: c.specId, level: c.level, ilvl: c.ilvl, rating: c.rating,
          faction: u.faction, isMain: c.isMain, bucket: c.bucket, sortOrder: i,
        },
        update: {
          classId: c.classId, specId: c.specId, level: c.level, ilvl: c.ilvl, rating: c.rating,
          faction: u.faction, isMain: c.isMain, bucket: c.bucket,
        },
      });
    }
  }

  return idByBnetId;
}

/** Creates (or updates the status of) a FriendRequest between two seeded
 * users, direction-aware — reused for both "accepted" (friendship) and
 * "pending" (incoming/outgoing) rows. */
async function ensureFriendRequest(
  requesterBnetId: string, addresseeBnetId: string, status: "pending" | "accepted", users: Map<string, string>
) {
  const requesterUserId = users.get(requesterBnetId)!;
  const addresseeUserId = users.get(addresseeBnetId)!;
  const existing = await prisma.friendRequest.findFirst({
    where: { OR: [{ requesterUserId, addresseeUserId }, { requesterUserId: addresseeUserId, addresseeUserId: requesterUserId }] },
  });
  if (existing) {
    if (existing.status !== status) await prisma.friendRequest.update({ where: { id: existing.id }, data: { status } });
    return;
  }
  await prisma.friendRequest.create({ data: { requesterUserId, addresseeUserId, status } });
}

async function seedDirectMessages(users: Map<string, string>) {
  const u1 = users.get("dev-fake-1")!;
  const u2 = users.get("dev-fake-2")!;
  const existing = await prisma.message.count({ where: { OR: [{ senderId: u1, recipientId: u2 }, { senderId: u2, recipientId: u1 }] } });
  if (existing > 0) return;

  await prisma.message.createMany({
    data: [
      { senderId: u1, recipientId: u2, body: "hey, up for some keys tonight?" },
      { senderId: u2, recipientId: u1, body: "yeah! what level are we pushing" },
      { senderId: u1, recipientId: u2, body: "aiming for +10s to start" },
    ],
  });
}

/** A Team Group whose 4th member (dev-fake-6) is deliberately NOT friends
 * with anyone else in it — exercises the in-group "Add Friend" affordance
 * (see ChatGroupInfoPanel) without needing to set that up by hand every
 * reset. Membership is inserted directly (bypassing the app's
 * friends-only-add gate, which is enforced at the API layer, not the DB —
 * same as everywhere else in this schema) specifically to get that state. */
async function seedChatGroup(users: Map<string, string>) {
  const u1 = users.get("dev-fake-1")!;
  const u2 = users.get("dev-fake-2")!;
  const u4 = users.get("dev-fake-4")!;
  const u6 = users.get("dev-fake-6")!;

  const existing = await prisma.chatGroup.findFirst({ where: { ownerUserId: u1, name: "Mythic Team" } });
  if (existing) return;

  const group = await prisma.chatGroup.create({
    data: {
      name: "Mythic Team",
      ownerUserId: u1,
      members: {
        create: [
          { userId: u1, addedByUserId: u1 },
          { userId: u2, addedByUserId: u1 },
          { userId: u4, addedByUserId: u1 },
          { userId: u6, addedByUserId: u1 },
        ],
      },
    },
  });

  await prisma.chatGroupMessage.createMany({
    data: [
      { chatGroupId: group.id, senderId: u1, body: "welcome to the team!" },
      { chatGroupId: group.id, senderId: u2, body: "hyped for progression" },
      { chatGroupId: group.id, senderId: u6, body: "hey all, new here \u{1F44B}" },
    ],
  });
}

/** One LFG board listing + a pending application, for exercising List/Apply/
 * Pending Requests without needing to create them by hand first. */
async function seedLfgListing(users: Map<string, string>) {
  const owner = users.get("dev-fake-4")!;
  // A 5-player M+ group is 1 tank + 1 healer + 3 dps; the owner fills tank,
  // so the open slots are 1 healer + 3 dps (an earlier version of this seed
  // only had 1 dps slot — fixed here, and re-corrected on existing rows too
  // since seeding is meant to be safe/idempotent to re-run).
  const slots = JSON.stringify([
    { role: "HEALER", prefs: [] },
    { role: "DPS", prefs: [] },
    { role: "DPS", prefs: [] },
    { role: "DPS", prefs: [] },
  ]);

  // The owner always fills a GroupMember slot for their own ownerRole (see
  // createGroup in src/data/groups.ts) — an earlier version of this seed
  // created the Group row directly and skipped that, so the card rendered
  // with no leader avatar and Tank missing entirely (neither filled nor
  // open). Fixed here, and self-healed on existing rows too.
  const ownerChar = await prisma.character.findFirst({ where: { userId: owner, classId: "warrior" } });

  const existing = await prisma.group.findFirst({ where: { ownerUserId: owner, title: "Test +10 Algeth'ar" } });
  if (existing) {
    if (existing.slots !== slots) await prisma.group.update({ where: { id: existing.id }, data: { slots } });
    const hasLeader = await prisma.groupMember.findFirst({ where: { groupId: existing.id, slot: 0 } });
    if (!hasLeader && ownerChar) {
      await prisma.groupMember.create({
        data: { groupId: existing.id, characterId: ownerChar.id, role: "TANK", specId: "warrior:protection", slot: 0 },
      });
    }
    return;
  }

  const listing = await prisma.group.create({
    data: {
      ownerUserId: owner,
      title: "Test +10 Algeth'ar",
      kind: "mplus",
      dungeonId: "aa",
      keyLevel: 10,
      ownerRole: "TANK",
      slots,
      ...(ownerChar
        ? { members: { create: { characterId: ownerChar.id, role: "TANK", specId: "warrior:protection", slot: 0 } } }
        : {}),
    },
  });

  const applicantUserId = users.get("dev-fake-3")!;
  const applicantChar = await prisma.character.findFirst({ where: { userId: applicantUserId, classId: "hunter" } });
  if (applicantChar) {
    await prisma.application.create({
      data: {
        groupId: listing.id, applicantUserId, characterId: applicantChar.id,
        role: "DPS", specId: "hunter:marksmanship", status: "pending",
      },
    });
  }
}

async function main() {
  const users = await seedUsers();

  // dev-fake-1 <-> dev-fake-2 and <-> dev-fake-4: established friendships,
  // ready to chat immediately. dev-fake-3 -> dev-fake-1: incoming pending
  // (Accept/Decline test). dev-fake-1 -> dev-fake-5: outgoing pending
  // (Cancel test). dev-fake-6 stays unconnected to everyone except via the
  // Team Group below — a fresh "Add Friend" target.
  await ensureFriendRequest("dev-fake-1", "dev-fake-2", "accepted", users);
  await ensureFriendRequest("dev-fake-1", "dev-fake-4", "accepted", users);
  await ensureFriendRequest("dev-fake-3", "dev-fake-1", "pending", users);
  await ensureFriendRequest("dev-fake-1", "dev-fake-5", "pending", users);

  await seedDirectMessages(users);
  await seedChatGroup(users);
  await seedLfgListing(users);

  console.log(`Seeded ${USERS.length} fake users: ${USERS.map((u) => u.battletag).join(", ")}`);
}

main().finally(() => prisma.$disconnect());
