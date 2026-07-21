import { Suspense } from "react";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { listRaidTeams } from "@/data/guilds";
import { listRaiderProfiles } from "@/data/raiderProfiles";
import { GuildsClient } from "@/components/guilds/GuildsClient";
import { SkeletonList } from "@/components/ui/Skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guilds | M+ Queue Simulator",
  description:
    "Find a raid guild, raid team, trial or substitute spot - and advertise yourself to guilds recruiting now.",
};

export default async function GuildsPage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;

  // Resolved first so blocked owners are absent from the first paint - see the
  // same pattern on the recruitment page.
  const viewer = s?.bnetId ? await ensureUser(s.bnetId, s.battletag) : null;

  const [teams, raiders] = await Promise.all([
    listRaidTeams({ viewerUserId: viewer?.id }),
    listRaiderProfiles({ viewerUserId: viewer?.id }),
  ]);

  return (
    <Suspense fallback={<SkeletonList />}>
      <GuildsClient initialTeams={teams} initialRaiders={raiders} signedIn={!!s?.bnetId} />
    </Suspense>
  );
}
