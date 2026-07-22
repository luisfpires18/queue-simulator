// Single hardcoded owner account. Admin status comes straight from the
// Battle.net-verified battletag on the session, never a DB flag or role
// table, so there's no row anyone could edit (or migration bug) to grant
// themselves access - only whoever controls this exact Battle.net account.
export const ADMIN_BATTLETAG = "Unreally#21342";

export function isAdminBattletag(battletag?: string | null): boolean {
  return battletag === ADMIN_BATTLETAG;
}
