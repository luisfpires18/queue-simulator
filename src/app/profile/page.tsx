import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters, getSpecTracks } from "@/data/characters";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { bestSpecFor } from "@/game/roster";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;

  // Checking bnetId, not just user - a session can carry a `user` object
  // with no bnetId (stale cookie predating this field); ensureUser(bnetId!,
  // ...) below would otherwise crash instead of just bouncing to login.
  if (!s?.user || !s?.bnetId) redirect("/login");

  const user = await ensureUser(s.bnetId!, s.battletag);
  const characters = await getUserCharacters(user.id);
  const withTracks = await Promise.all(
    characters.map(async (c) => ({ ...c, specTracks: await getSpecTracks(c.id) }))
  );
  const displayName = s.battletag?.split("#")[0] ?? "Profile";
  const mainChar = withTracks.find((c) => c.isMain) ?? withTracks[0] ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">{displayName}</h1>
        <p className="text-gray-400 text-sm">Sync from Battle.net, arrange your roster, and track your parses.</p>
      </div>
      <ProfileOverview
        battletag={s.battletag ?? null}
        memberSince={user.createdAt.toISOString()}
        characterCount={withTracks.length}
        country={user.country}
        main={mainChar ? { name: mainChar.name, classId: mainChar.classId, specId: bestSpecFor(mainChar) || null, rating: mainChar.rating } : null}
      />
      <ProfileClient initial={withTracks} />
    </div>
  );
}
