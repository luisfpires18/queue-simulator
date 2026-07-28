import { listTeams, getMyTeam } from "@/data/teams";
import { getMyTeamApplicationsByTeam, getPendingCountsByTeam } from "@/data/teamApplications";
import { getCurrentSelection } from "@/data/users";
import { getSessionUser } from "@/server/http";
import { TeamBoardClient } from "@/components/teams/TeamBoardClient";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  // Cached - see the same block in runs/page.tsx.
  const [teams, ctx] = await Promise.all([listTeams(), getSessionUser()]);
  const loggedIn = ctx != null;
  const user = ctx?.user ?? null;
  const [current, myTeam, myApps] = user
    ? await Promise.all([
        getCurrentSelection(user.id),
        // Fetched separately from `teams` on purpose: a full roster unlists
        // itself, so the viewer's own team can be absent from the board while
        // still being theirs to see and manage.
        getMyTeam(user.id),
        // Seeds each card's Apply-button state into the first paint.
        getMyTeamApplicationsByTeam(user.id, teams.map((t) => t.id)),
      ])
    : [null, null, {}];

  // Only the owner sees a pending count, and one user owns at most one team.
  const pendingCounts =
    myTeam && myTeam.ownerUserId === user?.id ? await getPendingCountsByTeam([myTeam.id]) : undefined;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-black">Teams</h1>
        <p className="text-gray-400 text-sm">Persistent rosters recruiting members.</p>
      </div>
      <TeamBoardClient
        initial={teams}
        current={current}
        canApply={loggedIn && current != null}
        loggedIn={loggedIn}
        viewerUserId={user?.id ?? null}
        myTeam={myTeam}
        initialMyApps={myApps}
        initialPendingCounts={pendingCounts}
      />
    </div>
  );
}
