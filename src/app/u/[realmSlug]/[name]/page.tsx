import { notFound } from "next/navigation";
import { getPublicCharacters } from "@/data/characters";
import { fetchCharacterTitles } from "@/data/blizzardApp";
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

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ realmSlug: string; name: string }>;
}) {
  const { realmSlug, name } = await params;
  const data = await getPublicCharacters(decodeURIComponent(realmSlug), decodeURIComponent(name));
  if (!data) notFound();

  const byBucket: Record<string, typeof data.characters> = { main: [], alt: [] };
  for (const c of data.characters) byBucket[c.bucket]?.push(c);
  const mainChar = data.characters.find((c) => c.isMain) ?? data.characters[0] ?? null;
  const displayName = data.battletag?.split("#")[0] ?? mainChar?.name ?? "Player";
  const r1Titles = mainChar ? await fetchR1TitleCount(mainChar.region, mainChar.realmSlug, mainChar.name) : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">{displayName}</h1>
      {mainChar && (
        <ProfileOverview
          battletag={data.battletag}
          memberSince={data.memberSince}
          characterCount={data.characters.length}
          country={data.country}
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
      {!data.characters.length && <div className="panel p-8 text-center text-gray-500">No public characters.</div>}
    </div>
  );
}
