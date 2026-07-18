import Link from "next/link";
import { auth } from "@/auth";
import { listGroups, ensureUser, getCurrentSelection } from "@/data/source";
import { RaidBoardClient } from "@/components/RaidBoardClient";

export const dynamic = "force-dynamic";

export default async function RaidsPage() {
  const [groups, session] = await Promise.all([listGroups(), auth()]);
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  const loggedIn = Boolean(s?.user);

  const user = loggedIn ? await ensureUser(s!.bnetId!, s!.battletag) : null;
  const current = user ? await getCurrentSelection(user.id) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black">Raid Runs</h1>
          <p className="text-gray-400 text-sm">Live raids listed by players.</p>
        </div>
        {loggedIn && (
          <Link href="/list?kind=raid" className="btn-gold">List your Raid</Link>
        )}
      </div>
      <RaidBoardClient initial={groups} canList={loggedIn} current={current} viewerUserId={user?.id ?? null} />
    </div>
  );
}
