import { Suspense } from "react";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { listMPlusPosts } from "@/data/mplusRecruitment";
import { TEAM_POST_TYPES } from "@/game/recruitmentTypes";
import { RecruitmentClient } from "@/components/recruitment/RecruitmentClient";
import { SkeletonList } from "@/components/ui/Skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recruitment M+ | M+ Queue Simulator",
  description:
    "Find a persistent Mythic+ team, push partners or a weekly vault group - separate from one-off key listings.",
};

/** Server-rendered first paint for both browse tabs, matching how /runs seeds
 * BoardClient. Filtering past this point happens client-side against the API. */
export default async function RecruitmentPage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;

  // Resolved before the listing queries so blocked owners can be filtered out
  // of the very first paint, not just after a client refetch.
  const viewer = s?.bnetId ? await ensureUser(s.bnetId, s.battletag) : null;

  const [teams, players] = await Promise.all([
    listMPlusPosts({ postTypes: [...TEAM_POST_TYPES], viewerUserId: viewer?.id }),
    listMPlusPosts({ postType: "player_lft", viewerUserId: viewer?.id }),
  ]);

  return (
    // useSearchParams in the client component requires a Suspense boundary
    // under the app router.
    <Suspense fallback={<SkeletonList />}>
      <RecruitmentClient initialTeams={teams} initialPlayers={players} signedIn={!!s?.bnetId} />
    </Suspense>
  );
}
