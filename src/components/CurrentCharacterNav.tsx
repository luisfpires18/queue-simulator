import { auth } from "@/auth";
import { ensureUser, getUserCharacters, getSpecTracks, getCurrentSelection } from "@/data/source";
import { CurrentCharacterPicker } from "./CurrentCharacterPicker";

// Server component: resolves the navbar's global "current character" (who
// List-a-key/Apply act as) and hands the picker its roster + starting value.
export async function CurrentCharacterNav() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) return null;

  const user = await ensureUser(s.bnetId, s.battletag);
  const chars = (await getUserCharacters(user.id)).filter((c) => c.bucket !== "hidden");
  if (chars.length === 0) return null;

  const characters = await Promise.all(chars.map(async (c) => ({ ...c, specTracks: await getSpecTracks(c.id) })));
  const current = await getCurrentSelection(user.id);

  return <CurrentCharacterPicker characters={characters} current={current} />;
}
