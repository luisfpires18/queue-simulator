import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Separate from vitest.config.ts on purpose: these tests hit a real (throwaway)
// SQLite database, and folding them into the main config would attach a Prisma
// setup to all 32 pure-function test files and run `prisma db push` for each
// one. Run with `npm run test:integration`; `npm test` runs both suites.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["test/integration/**/*.test.ts"],
    environment: "node",
    // globalSetup builds the schema once for the whole run; setupFiles
    // truncates between individual tests.
    globalSetup: ["test/integration/globalSetup.ts"],
    setupFiles: ["test/integration/setup.ts"],
    // One shared SQLite file, so parallel workers would truncate each other's
    // rows mid-test.
    fileParallelism: false,
    poolOptions: { threads: { singleThread: true } },
  },
});
