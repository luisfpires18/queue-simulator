import Link from "next/link";
import { listGroups } from "@/data/groups";
import { getMyApplicationsByGroup, getPendingCountsByGroup } from "@/data/applications";
import { getCurrentSelection } from "@/data/users";
import { getSessionUser } from "@/server/http";
import { RaidBoardClient } from "@/components/RaidBoardClient";

export const dynamic = "force-dynamic";

export default async function RaidsPage() {
  // Cached - see the same block in runs/page.tsx.
  const [groups, ctx] = await Promise.all([listGroups(), getSessionUser()]);
  const loggedIn = ctx != null;
  const user = ctx?.user ?? null;
  // Independent of each other - see the same block in runs/page.tsx.
  const [current, myApps, pendingCounts] = user
    ? await Promise.all([
        getCurrentSelection(user.id),
        // Seeds each card's Apply-button state into the first paint - without
        // it every card flashes "Apply" until its /my-application fetch lands.
        getMyApplicationsByGroup(user.id, groups.map((g) => g.id)),
        // Seeds the owner's pending-requests badge.
        getPendingCountsByGroup(groups.filter((g) => g.ownerUserId === user.id).map((g) => g.id)),
      ])
    : [null, undefined, undefined];

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
      <RaidBoardClient initial={groups} canList={loggedIn} current={current} viewerUserId={user?.id ?? null} initialMyApps={myApps} initialPendingCounts={pendingCounts} />
    </div>
  );
}
