import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser, getCurrentSelection } from "@/data/users";
import { getMyTeam, getTeam } from "@/data/teams";
import { TeamForm } from "@/components/teams/TeamForm";

export const dynamic = "force-dynamic";

export default async function TeamListPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  // bnetId, not just user - a stale cookie can carry `user` with no bnetId.
  if (!s?.user || !s?.bnetId) redirect("/profile");

  const user = await ensureUser(s.bnetId!, s.battletag);
  const current = await getCurrentSelection(user.id);

  const { edit } = await searchParams;
  const editTeam = edit ? await getTeam(edit) : null;
  if (edit && (!editTeam || editTeam.ownerUserId !== user.id)) notFound();

  // One team per user: someone already on a roster can only edit their own,
  // never create a second one.
  const myTeam = editTeam ? null : await getMyTeam(user.id);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-black mb-1">{editTeam ? "Edit your team" : "Start a team"}</h1>
      <p className="text-gray-400 text-sm mb-5">
        Set what the team plays, who you&apos;re recruiting, and the bar applicants have to clear.
      </p>

      {!current ? (
        <div className="panel p-8 text-center space-y-2">
          <p className="text-gray-300">No characters yet.</p>
          <p className="text-gray-500 text-sm">
            Go to <Link href="/profile" className="text-accent underline">Characters</Link> and sync from Battle.net.
          </p>
        </div>
      ) : myTeam ? (
        <div className="panel p-8 text-center space-y-2">
          <p className="text-gray-300">You&apos;re already on {myTeam.name}.</p>
          <p className="text-gray-500 text-sm">
            {myTeam.ownerUserId === user.id ? (
              <Link href={`/teams/list?edit=${myTeam.id}`} className="text-accent underline">Edit that team</Link>
            ) : (
              <>Leave it from the roster on <Link href="/teams" className="text-accent underline">Teams</Link> before starting your own.</>
            )}
          </p>
        </div>
      ) : (
        <TeamForm current={current} editTeam={editTeam} />
      )}
    </div>
  );
}
