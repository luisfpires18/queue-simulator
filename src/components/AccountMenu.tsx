import Link from "next/link";
import { signOut, bnetEnabled } from "@/auth";
import { getAccountMenuData } from "@/data/accountMenu";
import { getSessionUser } from "@/server/http";
import { seasonById } from "@/game/season";
import { AccountMenuClient } from "./AccountMenuClient";

/** Server component: the single header account control — replaces what used
 * to be three separate chips (character picker, Network indicator, account/
 * logout). Resolves everything a logged-in user's dropdown needs in one
 * pass; logged-out just gets a login link, same as the old HeaderAuth. */
export async function AccountMenu() {
  // Cached - the layout renders this component twice (desktop + mobile
  // drawer) and resolves the same session itself, so all three share one call.
  const ctx = await getSessionUser();

  if (!ctx) {
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

  const { user, session: s } = ctx;
  const { characters, current, friends, incoming, outgoing, chatGroups, currentSeasonId } =
    await getAccountMenuData(user.id);
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
      initialChatGroups={chatGroups}
      season={season}
      onLogout={logout}
    />
  );
}
