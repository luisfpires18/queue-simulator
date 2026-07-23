import Link from "next/link";
import { getPublicCharacters } from "@/data/characters";
import { fetchLivePlayerProfile } from "@/data/livePlayer";
import { fetchCharacterTitles } from "@/data/blizzardApp";
import { fetchRaidProgression } from "@/data/raiderio";
import { MPLUS_R1_TITLE_IDS } from "@/game/mplusTitles";
import { CharacterCard } from "@/components/CharacterCard";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { bestSpecFor } from "@/game/roster";

// Titles are account-wide, so one character's title list already reflects
// the whole account - no need to fetch per character on a multi-alt roster.
// Best-effort: a Blizzard hiccup shouldn't fail the whole profile page, it
// should just hide the stat (null, distinct from a genuine 0).
async function fetchR1TitleCount(region: string, realmSlug: string, name: string): Promise<number | null> {
  try {
    const titles = await fetchCharacterTitles(region, realmSlug, name);
    return titles.filter((t) => MPLUS_R1_TITLE_IDS.includes(t.id)).length;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

const BUCKET_TITLE: Record<string, string> = { main: "Main", alt: "Alts" };

// Universal player search result: checks this app's own registered accounts
// first - if the searched character's owner has ever logged in here via
// Battle.net, this shows their FULL roster (every synced alt, real buckets,
// raid-kill tracking), since that's the only way to actually know every
// character on an account (no public API exposes that). Falls back to a
// live raider.io-only snapshot of just the one searched character when
// nobody has ever synced them here. See src/data/livePlayer.ts.
export default async function PlayerSearchResultPage({
  params,
}: {
  params: Promise<{ region: string; realmSlug: string; name: string }>;
}) {
  const { region, realmSlug, name } = await params;
  const decodedRealmSlug = decodeURIComponent(realmSlug);
  const decodedName = decodeURIComponent(name);

  const registered = await getPublicCharacters(decodedRealmSlug, decodedName);
  if (registered) {
    // Fallback only for characters WCL gave us nothing for (most commonly:
    // their logs are private) - not a blanket extra API call per character.
    const characters = await Promise.all(
      registered.characters.map(async (c) => {
        if (c.raidKills.length > 0) return c;
        const raidProgressFallback = await fetchRaidProgression(c.region, c.realmSlug, c.name).catch(() => null);
        return { ...c, raidProgressFallback };
      })
    );

    const byBucket: Record<string, typeof characters> = { main: [], alt: [] };
    for (const c of characters) byBucket[c.bucket]?.push(c);
    const mainChar = characters.find((c) => c.isMain) ?? characters[0] ?? null;
    const displayName = registered.battletag?.split("#")[0] ?? mainChar?.name ?? "Player";
    const r1Titles = mainChar ? await fetchR1TitleCount(mainChar.region, mainChar.realmSlug, mainChar.name) : null;

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-black">{displayName}</h1>
        {mainChar && (
          <ProfileOverview
            battletag={registered.battletag}
            memberSince={registered.memberSince}
            characterCount={registered.characters.length}
            country={registered.country}
            main={{ name: mainChar.name, classId: mainChar.classId, specId: bestSpecFor(mainChar) || null, rating: mainChar.rating }}
            r1Titles={r1Titles}
          />
        )}
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
      </div>
    );
  }

  const live = await fetchLivePlayerProfile(region.toLowerCase(), decodedRealmSlug, decodedName);
  if (!live) {
    return (
      <div className="panel p-10 text-center space-y-2">
        <p className="text-gray-300 font-semibold">No character found.</p>
        <p className="text-gray-500 text-sm">
          Check the name, realm, and region. They may also have no logged Mythic+ runs yet.
        </p>
        <Link href="/" className="text-accent text-sm hover:underline inline-block mt-2">← Back home</Link>
      </div>
    );
  }

  const liveR1Titles = await fetchR1TitleCount(live.region, live.realmSlug, live.name);

  return (
    <div className="space-y-5">
      <ProfileOverview
        battletag={null}
        memberSince={null}
        characterCount={null}
        main={{ name: live.name, classId: live.classId, specId: live.specId, rating: live.rating }}
        r1Titles={liveR1Titles}
        live
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <CharacterCard character={live} dungeonsDefaultOpen showProfileLinks />
      </div>
    </div>
  );
}
