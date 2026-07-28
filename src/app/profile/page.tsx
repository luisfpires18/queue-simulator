import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/http";
import { getUserCharacters, getSpecTracksByCharacter } from "@/data/characters";
import { getCurrentSeasonId } from "@/data/appSettings";
import { getMyTeam } from "@/data/teams";
import { listDeclineRecords } from "@/data/declineRecords";
import { SEASONS } from "@/game/season";
import { ProfileClient } from "@/components/profile/ProfileClient";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { TwitchLiveBadge } from "@/components/profile/TwitchLiveBadge";
import { TwitchLivePreviewGate } from "@/components/profile/TwitchLivePreviewGate";
import { SeasonSelector } from "@/components/profile/SeasonSelector";
import { bestSpecFor } from "@/game/roster";
import { highestCharacterRating } from "@/game/rating";

export const dynamic = "force-dynamic";

const FEEDBACK_PAGE_SIZE = 10;

export default async function ProfilePage() {
  // Cached - see the same block in runs/page.tsx.
  const ctx = await getSessionUser();
  if (!ctx) redirect("/login");
  const { user, session: s } = ctx;
  // All independent - awaiting them in sequence made the server render
  // round trips deep for no reason (see the same block in runs/page.tsx).
  // The decline history seeds the Feedback tab's default (received/page-1)
  // view - see ProfileClient/FeedbackTab.
  const [characters, currentSeasonId, myTeam, feedback] = await Promise.all([
    getUserCharacters(user.id),
    getCurrentSeasonId(),
    getMyTeam(user.id),
    listDeclineRecords(user.id, "received", 1, FEEDBACK_PAGE_SIZE),
  ]);
  const tracksByChar = await getSpecTracksByCharacter(characters.map((c) => c.id));
  const withTracks = characters.map((c) => ({ ...c, specTracks: tracksByChar.get(c.id) ?? [] }));
  const displayName = s.battletag?.split("#")[0] ?? "Profile";
  const mainChar = withTracks.find((c) => c.isMain) ?? withTracks[0] ?? null;
  const initialSettings = {
    showBattletag: user.showBattletag,
    country: user.country,
    discord: user.discord,
    twitch: user.twitch,
    aboutMe: user.aboutMe,
    bannerType: user.bannerType,
    bannerClassId: user.bannerClassId,
    bannerImage: user.bannerImage,
    lftStatus: user.lftStatus,
  };

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
        twitchLiveBadge={
          <Suspense fallback={null}>
            <TwitchLiveBadge twitch={user.twitch} />
          </Suspense>
        }
        main={mainChar ? { name: mainChar.name, classId: mainChar.classId, specId: bestSpecFor(mainChar) || null } : null}
        highestRating={highestCharacterRating(withTracks)}
        banner={{ bannerType: user.bannerType, bannerClassId: user.bannerClassId, bannerImage: user.bannerImage }}
        aboutMe={user.aboutMe}
        team={myTeam}
        lftStatus={user.lftStatus}
        viewerUserId={user.id}
        isOwnProfile
      />
      <Suspense fallback={null}>
        <TwitchLivePreviewGate twitch={user.twitch} />
      </Suspense>
      <ProfileClient
        initial={withTracks}
        currentSeasonId={currentSeasonId}
        hasTeam={myTeam != null}
        initialSettings={initialSettings}
        initialFeedback={{ ...feedback, page: 1, pageSize: FEEDBACK_PAGE_SIZE }}
      />
    </div>
  );
}
