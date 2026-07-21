// Per-test-file setup: points Prisma at the throwaway database that
// globalSetup created, and truncates between tests.
//
// The DATABASE_URL assignment MUST happen before anything imports
// src/lib/prisma - that module reads the variable at load time, so a later
// assignment would be ignored and the tests would silently run against
// prisma/dev.db and delete real local data. Hence the top-level statement and
// the lazy imports below.
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";

process.env.DATABASE_URL = `file:${join(process.cwd(), "node_modules", ".tmp", "integration.db")}`;

/** Children before parents - SQLite has no TRUNCATE CASCADE. Deleting User
 * last would fail on foreign keys from Character and the rest. */
const TABLES = [
  "FeatureAccess",
  "FeatureFlag",
  "RecruitmentApplication",
  "UserBlock",
  "Report",
  "MPlusRecruitmentCharacter",
  "MPlusRecruitmentPosition",
  "MPlusRecruitmentPost",
  "RaidRecruitmentPosition",
  "RaidTeam",
  "Guild",
  "RaiderProfile",
  "Application",
  "GroupMember",
  "Group",
  "SoloQueueEntry",
  "CharacterSpecTrack",
  "RunMember",
  "Run",
  "Character",
  "NotificationPreference",
  "PushSubscription",
  "User",
];

beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
