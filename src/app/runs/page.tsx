import Link from "next/link";
import { listGroups } from "@/data/groups";
import { getMyApplicationsByGroup, getPendingCountsByGroup } from "@/data/applications";
import { getCurrentSelection } from "@/data/users";
import { getMySoloQueueStatus } from "@/data/soloQueue";
import { isFeatureEnabled } from "@/data/featureFlags";
import { getSessionUser } from "@/server/http";
import { BoardClient } from "@/components/BoardClient";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  // Cached - the layout already resolved this for AccountMenu, so this
  // reuses that call instead of a second session decrypt + ensureUser round
  // trip.
  const [groups, ctx, soloQueueEnabled] = await Promise.all([listGroups(), getSessionUser(), isFeatureEnabled("soloQueue")]);
  const loggedIn = ctx != null;
  const user = ctx?.user ?? null;
  // All four are independent and only need user.id - awaiting them in
  // sequence made the server render four round trips deep for no reason.
  const [current, myApps, pendingCounts, soloQueueStatus] = user
    ? await Promise.all([
        getCurrentSelection(user.id),
        // Seeds each card's Apply-button state into the first paint - without
        // it every card flashes "Apply" until its /my-application fetch lands.
        getMyApplicationsByGroup(user.id, groups.map((g) => g.id)),
        // Seeds the owner's "Pending Requests (N)" badge, which otherwise
        // renders nothing at all until the last query on the page resolves.
        getPendingCountsByGroup(groups.filter((g) => g.ownerUserId === user.id).map((g) => g.id)),
        // Same seeding for the Solo Queue panel - without it, it flashes "Find
        // Group" (idle) until its own poll lands, even when already queued.
        getMySoloQueueStatus(user.id),
      ])
    : [null, undefined, undefined, undefined];

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
      <BoardClient initial={groups} canList={loggedIn} current={current} viewerUserId={user?.id ?? null} initialMyApps={myApps} initialPendingCounts={pendingCounts} initialSoloQueueStatus={soloQueueStatus} soloQueueEnabled={soloQueueEnabled} />
    </div>
  );
}
