// Maintenance actions the dashboard can trigger.
//
// Everything here has a real side effect, so each is explicit about what it
// touched and the UI confirms before calling. None of them delete user
// content: the sweep closes listings rather than removing them, and the cache
// clear only discards data that can be re-fetched.
import { rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { sweepExpired } from "./recruitment/sweep";

export type OpsAction = "sweep" | "clear_wcl_cache";

export interface OpsResult {
  action: OpsAction;
  ok: boolean;
  message: string;
  detail?: Record<string, number | string>;
}

/** Warcraft Logs disk cache, matching CACHE_DIR in src/server/wcl/client.js.
 * Derived the same way (project root + /cache) rather than imported, because
 * that module is plain JS with no export for it. */
const WCL_CACHE_DIR = path.join(process.cwd(), "cache");

export async function runSweep(): Promise<OpsResult> {
  const result = await sweepExpired();
  const total =
    result.mplusPostsClosed +
    result.raidTeamsClosed +
    result.raiderProfilesClosed +
    result.applicationsExpired;

  return {
    action: "sweep",
    ok: true,
    message: total
      ? `Closed ${total} expired row${total === 1 ? "" : "s"}.`
      : "Nothing had expired.",
    detail: { ...result },
  };
}

/** Deletes the cached Warcraft Logs responses.
 *
 * Safe but not free: everything cleared has to be re-fetched from WCL on the
 * next request, which spends the shared token budget and makes the first load
 * of each analysis slow again. Only the cache directory's CONTENTS go - the
 * directory itself stays so client.js does not have to recreate it. */
export async function clearWclCache(): Promise<OpsResult> {
  if (!existsSync(WCL_CACHE_DIR)) {
    return { action: "clear_wcl_cache", ok: true, message: "No cache directory to clear." };
  }

  const entries = await readdir(WCL_CACHE_DIR);
  let files = 0;
  let bytes = 0;

  for (const entry of entries) {
    const full = path.join(WCL_CACHE_DIR, entry);
    try {
      const info = await stat(full);
      if (info.isFile()) bytes += info.size;
      await rm(full, { recursive: true, force: true });
      files++;
    } catch (err) {
      // One locked or vanished file should not abort the whole clear.
      console.error("clearWclCache: could not remove", full, err);
    }
  }

  return {
    action: "clear_wcl_cache",
    ok: true,
    message: `Cleared ${files} cache entr${files === 1 ? "y" : "ies"} (${(bytes / 1024 / 1024).toFixed(1)} MB).`,
    detail: { files, bytes },
  };
}

export async function runOpsAction(action: OpsAction): Promise<OpsResult> {
  switch (action) {
    case "sweep":
      return runSweep();
    case "clear_wcl_cache":
      return clearWclCache();
    default:
      return { action, ok: false, message: "Unknown action." };
  }
}

/** Described for the UI so the dashboard does not hardcode copy, and so the
 * warning travels with the action rather than being forgotten. */
export const OPS_ACTIONS = [
  {
    action: "sweep" as const,
    label: "Run expiry sweep",
    description:
      "Closes listings and applications past their expiry. Idempotent, and nothing is deleted - an expired listing can still be refreshed.",
    danger: false,
  },
  {
    action: "clear_wcl_cache" as const,
    label: "Clear Warcraft Logs cache",
    description:
      "Discards cached WCL responses. Everything re-fetches on demand, which spends the shared token budget and makes the next analysis slow.",
    danger: true,
  },
];
