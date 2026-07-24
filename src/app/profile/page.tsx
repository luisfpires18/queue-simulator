import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters, getSpecTracks } from "@/data/characters";
import { getLiveStreamInfo } from "@/data/twitch";
import { getCurrentSeasonId } from "@/data/appSettings";
import { SEASONS } from "@/game/season";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { TwitchLivePreview } from "@/components/profile/TwitchLivePreview";
import { SeasonSelector } from "@/components/profile/SeasonSelector";
import { bestSpecFor } from "@/game/roster";
import { highestCharacterRating } from "@/game/rating";

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
  // Best-effort, same rationale as the public profile page - Twitch being
  // slow or unconfigured just hides the preview, never fails the page.
  const twitchLive = user.twitch ? await getLiveStreamInfo(user.twitch).catch(() => null) : null;

  const currentSeasonId = await getCurrentSeasonId();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{displayName}</h1>
          <p className="text-gray-400 text-sm">Sync from Battle.net, arrange your roster, and track your parses.</p>
        </div>
        {/* Every known season is browsable, not just ones with a snapshot
           yet - Season 2 shows up as a placeholder (SeasonSnapshotGrid's own
           "no snapshot yet" empty state handles it) even before it's live. */}
        <SeasonSelector seasons={SEASONS} currentSeasonId={currentSeasonId} />
      </div>
      <ProfileOverview
        battletag={s.battletag ?? null}
        memberSince={user.createdAt.toISOString()}
        characterCount={withTracks.length}
        country={user.country}
        discord={user.discord}
        twitch={user.twitch}
        twitchLive={twitchLive != null}
        main={mainChar ? { name: mainChar.name, classId: mainChar.classId, specId: bestSpecFor(mainChar) || null } : null}
        highestRating={highestCharacterRating(withTracks)}
      />
      {twitchLive && user.twitch && <TwitchLivePreview twitch={user.twitch} live={twitchLive} />}
      <ProfileClient initial={withTracks} currentSeasonId={currentSeasonId} />
    </div>
  );
}
