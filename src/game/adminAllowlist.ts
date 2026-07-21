// Who counts as an admin. Pure - reads one environment variable and does set
// membership, with no auth or Prisma imports, so it can be unit-tested and
// reasoned about on its own.
//
// An environment allowlist rather than an `isAdmin` column: there is no way to
// GRANT admin from inside the app, so there is no privilege-escalation path,
// and nobody is an admin by default. The cost is that changing admins needs a
// deploy, which is the right trade for a surface that can read every report.

/** Comma-separated Battle.net ids, e.g. ADMIN_BNET_IDS="12345678,87654321".
 * Unset or empty means nobody. */
function adminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_BNET_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function adminEnabled(): boolean {
  return adminIds().size > 0;
}

/** Exact set membership - deliberately not a prefix or substring test, so
 * "alic" can never pass for "alice". */
export function isAdminBnetId(bnetId: string | undefined | null): boolean {
  if (!bnetId) return false;
  return adminIds().has(bnetId);
}
