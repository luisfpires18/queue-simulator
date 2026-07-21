import Link from "next/link";
import { auth } from "@/auth";
import { listGroups } from "@/data/groups";
import { getMyApplicationsByGroup } from "@/data/applications";
import { ensureUser, getCurrentSelection } from "@/data/users";
import { RaidBoardClient } from "@/components/RaidBoardClient";

export const dynamic = "force-dynamic";

export default async function RaidsPage() {
  const [groups, session] = await Promise.all([listGroups(), auth()]);
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  // Checking bnetId, not just user - a session can carry a `user` object
  // with no bnetId (e.g. a stale cookie predating this field), and
  // ensureUser(bnetId!, ...) would otherwise crash with a Prisma validation
  // error on an undefined where-clause key instead of just showing logged-out.
  const loggedIn = Boolean(s?.user && s?.bnetId);

  const user = loggedIn ? await ensureUser(s!.bnetId!, s!.battletag) : null;
  const current = user ? await getCurrentSelection(user.id) : null;
  // Seeds each card's Apply-button state into the first paint - without it,
  // every card flashes "Apply" until its own /my-application fetch lands.
  const myApps = user ? await getMyApplicationsByGroup(user.id, groups.map((g) => g.id)) : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black">Raids</h1>
          <p className="text-gray-400 text-sm">Open raids, posted by players right now.</p>
        </div>
        {loggedIn && (
          <Link href="/list?kind=raid" className="btn-gold">List your Raid</Link>
        )}
      </div>
      <RaidBoardClient initial={groups} canList={loggedIn} current={current} viewerUserId={user?.id ?? null} initialMyApps={myApps} />
    </div>
  );
}
