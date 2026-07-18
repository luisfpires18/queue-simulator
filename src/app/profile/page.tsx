import { auth, signIn, bnetEnabled, devLoginEnabled } from "@/auth";
import { ensureUser, getUserCharacters, getSpecTracks } from "@/data/source";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { bestSpecFor } from "@/game/roster";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;

  if (!s?.user) {
    return (
      <div className="max-w-xl mx-auto panel p-8 text-center space-y-4">
        <h1 className="text-2xl font-black">Your Profile</h1>
        <p className="text-gray-400">Log in with Battle.net to sync your WoW characters.</p>
        {bnetEnabled ? (
          <form action={async () => { "use server"; await signIn("battlenet", { redirectTo: "/profile" }); }}>
            <button className="btn bg-[#00aeff] text-black hover:brightness-110">Login with Battle.net</button>
          </form>
        ) : (
          <p className="text-amber-400 text-sm">Battle.net login needs credentials (see .env).</p>
        )}
        {devLoginEnabled && (
          <form
            action={async () => { "use server"; await signIn("dev-login", { bnetId: "dev-fake-1", redirectTo: "/profile" }); }}
            className="pt-3 border-t border-panelborder/60"
          >
            <button className="btn-ghost text-xs px-3 py-1.5">
              Dev login as TestHero#1111 (fake, seeded — ALLOW_DEV_LOGIN=1)
            </button>
          </form>
        )}
      </div>
    );
  }

  const user = await ensureUser(s.bnetId!, s.battletag);
  const characters = await getUserCharacters(user.id);
  const withTracks = await Promise.all(
    characters.map(async (c) => ({ ...c, specTracks: await getSpecTracks(c.id) }))
  );
  const displayName = s.battletag?.split("#")[0] ?? "Profile";
  const mainChar = withTracks.find((c) => c.isMain) ?? withTracks[0] ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">{displayName}</h1>
        <p className="text-gray-400 text-sm">Sync from Battle.net, arrange your roster, and track your parses.</p>
      </div>
      <ProfileOverview
        battletag={s.battletag ?? null}
        memberSince={user.createdAt.toISOString()}
        characterCount={withTracks.length}
        country={user.country}
        main={mainChar ? { name: mainChar.name, classId: mainChar.classId, specId: bestSpecFor(mainChar) || null, rating: mainChar.rating } : null}
      />
      <ProfileClient initial={withTracks} />
    </div>
  );
}
