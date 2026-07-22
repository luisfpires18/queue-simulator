import { auth, signIn, bnetEnabled, devLoginEnabled } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters, getSpecTracks } from "@/data/characters";
import { ImprovementTab } from "@/components/improvement/ImprovementTab";

export const dynamic = "force-dynamic";

export default async function ImprovementPage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;

  // Same bnetId check as /profile - a session can carry a `user` with no
  // bnetId (stale cookie predating this field).
  if (!s?.user || !s?.bnetId) {
    return (
      <div className="max-w-xl mx-auto panel p-8 text-center space-y-4">
        <h1 className="text-2xl font-black">Parse Improvement</h1>
        <p className="text-gray-400">Log in with Battle.net to compare your parses against top players.</p>
        {bnetEnabled ? (
          <form action={async () => { "use server"; await signIn("battlenet", { redirectTo: "/improvement" }); }}>
            <button className="btn bg-[#00aeff] text-black hover:brightness-110">Login with Battle.net</button>
          </form>
        ) : (
          <p className="text-amber-400 text-sm">Battle.net login needs credentials (see .env).</p>
        )}
        {devLoginEnabled && (
          <form
            action={async () => { "use server"; await signIn("dev-login", { bnetId: "dev-fake-1", redirectTo: "/improvement" }); }}
            className="pt-3 border-t border-panelborder/60"
          >
            <button className="btn-ghost text-xs px-3 py-1.5">
              Dev login as TestHero#1111 (fake, seeded, ALLOW_DEV_LOGIN=1)
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Parse Improvement</h1>
        <p className="text-gray-400 text-sm">Compare your Mythic+ and raid parses against top players of your spec.</p>
      </div>
      <ImprovementTab characters={withTracks} />
    </div>
  );
}
