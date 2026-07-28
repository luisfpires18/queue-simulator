import { fetchCharacterTitles } from "@/data/blizzardApp";
import { MPLUS_R1_TITLE_IDS } from "@/game/mplusTitles";
import { MISC_ICON } from "@/game/icons";
import { Stat } from "./ProfileOverview";

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

/** ProfileOverview's `r1TitlesSlot` - meant to be wrapped in its own
 * <Suspense fallback={null}> so the Blizzard titles lookup doesn't block the
 * rest of the profile page. */
export async function R1TitlesStat({ region, realmSlug, name }: { region: string; realmSlug: string; name: string }) {
  const count = await fetchR1TitleCount(region, realmSlug, name);
  if (count == null) return null;
  return <Stat icon={MISC_ICON.keystone} label="M+ R1 Titles" value={String(count)} accent={count > 0} />;
}
