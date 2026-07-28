import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/server/http";
import { getPublicCharacters } from "@/data/characters";
import { fetchRaidProgression } from "@/data/raiderio";
import { CharacterCard } from "@/components/CharacterCard";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { R1TitlesStat } from "@/components/profile/R1TitlesStat";
import { TwitchLiveBadge } from "@/components/profile/TwitchLiveBadge";
import { TwitchLivePreviewGate } from "@/components/profile/TwitchLivePreviewGate";
import { AddFriendButton } from "@/components/network/AddFriendButton";
import { bestSpecFor } from "@/game/roster";
import { highestCharacterRating } from "@/game/rating";

export const dynamic = "force-dynamic";

const BUCKET_TITLE: Record<string, string> = { main: "Main", alt: "Alts" };

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ realmSlug: string; name: string }>;
}) {
  const { realmSlug, name } = await params;
  // Independent of each other - getSessionUser is cached (see the same
  // block in runs/page.tsx) and the layout already triggers it, so this is
  // free more often than not.
  const [data, ctx] = await Promise.all([
    getPublicCharacters(decodeURIComponent(realmSlug), decodeURIComponent(name)),
    getSessionUser(),
  ]);
  if (!data) notFound();
  const viewer = ctx?.user ?? null;

  // Fallback only for characters WCL gave us nothing for (most commonly:
  // their logs are private) - not a blanket extra API call per character.
  const characters = await Promise.all(
    data.characters.map(async (c) => {
      if (c.raidKills.length > 0) return c;
      const raidProgressFallback = await fetchRaidProgression(c.region, c.realmSlug, c.name).catch(() => null);
      return { ...c, raidProgressFallback };
    })
  );

  const byBucket: Record<string, typeof characters> = { main: [], alt: [] };
  for (const c of characters) byBucket[c.bucket]?.push(c);
  const mainChar = characters.find((c) => c.isMain) ?? characters[0] ?? null;
  const displayName = data.battletag?.split("#")[0] ?? mainChar?.name ?? "Player";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-black">{displayName}</h1>
        {viewer && viewer.id !== data.userId && <AddFriendButton targetUserId={data.userId} />}
      </div>
      {mainChar && (
        <ProfileOverview
          battletag={data.battletag}
          memberSince={data.memberSince}
          characterCount={data.characters.length}
          country={data.country}
          discord={data.discord}
          twitch={data.twitch}
          twitchLiveBadge={
            <Suspense fallback={null}>
              <TwitchLiveBadge twitch={data.twitch} />
            </Suspense>
          }
          main={{ name: mainChar.name, classId: mainChar.classId, specId: bestSpecFor(mainChar) || null }}
          highestRating={highestCharacterRating(characters)}
          r1TitlesSlot={
            <Suspense fallback={null}>
              <R1TitlesStat region={mainChar.region} realmSlug={mainChar.realmSlug} name={mainChar.name} />
            </Suspense>
          }
          banner={{ bannerType: data.bannerType, bannerClassId: data.bannerClassId, bannerImage: data.bannerImage }}
          aboutMe={data.aboutMe}
          team={data.team}
          lftStatus={data.lftStatus}
          viewerUserId={viewer?.id ?? null}
          isOwnProfile={viewer?.id === data.userId}
        />
      )}
      <Suspense fallback={null}>
        <TwitchLivePreviewGate twitch={data.twitch} />
      </Suspense>
      {(["main", "alt"] as const).map((bucket) =>
        byBucket[bucket].length ? (
          <div key={bucket} className="panel p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-3">{BUCKET_TITLE[bucket]}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {byBucket[bucket].map((c) => (
                <CharacterCard key={c.id} character={c} dungeonsDefaultOpen showProfileLinks />
              ))}
            </div>
          </div>
        ) : null
      )}
      {!data.characters.length && <div className="panel p-8 text-center text-gray-500">No public characters.</div>}
    </div>
  );
}
