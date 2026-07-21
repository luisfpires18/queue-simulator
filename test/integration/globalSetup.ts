// Runs ONCE per integration test run: builds a throwaway SQLite database from
// the current schema, and deletes it afterwards.
//
// The database file lives under node_modules/.tmp so it is already gitignored
// and never sits next to prisma/dev.db. `prisma db push` is used rather than
// migrations because that is how this project manages schema (there is no
// migrations directory), so the test schema is built exactly the way the real
// one is.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TMP_DIR = join(process.cwd(), "node_modules", ".tmp");
export const TEST_DB_FILE = join(TMP_DIR, "integration.db");
const TEST_DB_URL = `file:${TEST_DB_FILE}`;

export function setup() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
  // Start from nothing so a schema change between runs can never leave a
  // stale column behind.
  rmSync(TEST_DB_FILE, { force: true });

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });
}

export function teardown() {
  rmSync(TEST_DB_FILE, { force: true });
}
