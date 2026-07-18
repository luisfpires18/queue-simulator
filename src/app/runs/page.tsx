import Link from "next/link";
import { auth } from "@/auth";
import { listGroups, ensureUser, getCurrentSelection } from "@/data/source";
import { BoardClient } from "@/components/BoardClient";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const [groups, session] = await Promise.all([listGroups(), auth()]);
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  const loggedIn = Boolean(s?.user);

  const user = loggedIn ? await ensureUser(s!.bnetId!, s!.battletag) : null;
  const current = user ? await getCurrentSelection(user.id) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black">M+ Runs</h1>
          <p className="text-gray-400 text-sm">Live keys listed by players.</p>
        </div>
        {loggedIn && (
          <Link href="/list" className="btn-gold">List your Key</Link>
        )}
      </div>
      <BoardClient initial={groups} canList={loggedIn} current={current} viewerUserId={user?.id ?? null} />
    </div>
  );
}
