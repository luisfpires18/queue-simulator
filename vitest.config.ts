import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure-function tests only - no setup, no database, fast.
    // The DB-backed integration tests live in their own config
    // (vitest.integration.config.ts) so they cannot slow this suite down or
    // drag a Prisma setup into every one of these files.
    include: ["src/**/*.test.ts", "test/**/*.test.js"],
    environment: "node",
  },
});
