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
}

main().finally(() => prisma.$disconnect());
