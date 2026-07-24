import Link from "next/link";
import { auth, signOut, bnetEnabled } from "@/auth";
import { ensureUser, getCurrentSelection } from "@/data/users";
import { getUserCharacters, getSpecTracks } from "@/data/characters";
import { listFriends, listIncomingRequests, listOutgoingRequests } from "@/data/network";
import { getCurrentSeasonId } from "@/data/appSettings";
import { seasonById } from "@/game/season";
import { AccountMenuClient } from "./AccountMenuClient";

/** Server component: the single header account control — replaces what used
 * to be three separate chips (character picker, Network indicator, account/
 * logout). Resolves everything a logged-in user's dropdown needs in one
 * pass; logged-out just gets a login link, same as the old HeaderAuth. */
export async function AccountMenu() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;

  if (!s?.bnetId) {
    if (!bnetEnabled) {
      return (
        <Link
          href="/profile"
          title="Battle.net login needs credentials - see /profile"
          className="chip border border-panelborder text-gray-500 hover:text-gray-300"
        >
          Login (setup)
        </Link>
      );
    }
    return (
      <Link href="/login" className="btn bg-[#00aeff] text-black hover:brightness-110 px-3 py-1.5 text-xs">
        Login
      </Link>
    );
  }

  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = (await getUserCharacters(user.id)).filter((c) => c.bucket !== "hidden");
  const characters = await Promise.all(chars.map(async (c) => ({ ...c, specTracks: await getSpecTracks(c.id) })));
  const current = await getCurrentSelection(user.id);
  const [friends, incoming, outgoing, currentSeasonId] = await Promise.all([
    listFriends(user.id),
    listIncomingRequests(user.id),
    listOutgoingRequests(user.id),
    getCurrentSeasonId(),
  ]);
  const season = seasonById(currentSeasonId);
  const displayName = s.battletag?.split("#")[0] ?? "Account";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <AccountMenuClient
      characters={characters}
      current={current}
      displayName={displayName}
      battletag={s.battletag ?? null}
      initialFriends={friends}
      initialRequests={{ incoming, outgoing }}
      season={season}
      onLogout={logout}
    />
  );
}
