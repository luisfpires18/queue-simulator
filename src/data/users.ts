// User row materialization + the navbar's global current-character selection.
import { prisma } from "@/lib/prisma";
import { bestSpecFor } from "@/game/roster";
import { specById } from "@/game/classes";
import type { CurrentSelectionDTO, RosterCharacterDTO } from "./dto";
import { getSpecTracks, getUserCharacters } from "./characters";

export async function ensureUser(bnetId: string, battletag?: string) {
  return prisma.user.upsert({
    where: { bnetId },
    create: { bnetId, battletag },
    update: { battletag },
  });
}

/** Resolve this user's stored current-character selection against their live,
 * non-hidden roster. Falls back to (isMain ?? first) character and
 * bestSpecFor() when unset, or when the stored id/spec no longer resolves
 * (deleted, moved to hidden, spec no longer tracked). Null only when the user
 * has zero selectable (non-hidden) characters. */
export async function getCurrentSelection(userId: string): Promise<CurrentSelectionDTO | null> {
  const chars = await getUserCharacters(userId);
  const selectable = chars.filter((c) => c.bucket !== "hidden");
  if (selectable.length === 0) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const char = selectable.find((c) => c.id === user?.currentCharacterId)
    ?? selectable.find((c) => c.isMain)
    ?? selectable[0];

  const tracks = await getSpecTracks(char.id);
  const character: RosterCharacterDTO = { ...char, specTracks: tracks };

  // Valid = same class as the character, NOT "already has a CharacterSpecTrack
  // row" — the picker lets you choose any of the class's specs before you've
  // ever tracked/rated them (see specsFor's pre-curation fallback in
  // CurrentCharacterPicker.tsx), so requiring a pre-existing track here made
  // an untracked-but-legitimate pick (e.g. Guardian on a resto-only-tracked
  // druid) silently revert to bestSpecFor() on the very next read.
  const storedSpecId = char.id === user?.currentCharacterId ? user?.currentSpecId ?? null : null;
  const specId = storedSpecId && specById(storedSpecId)?.classId === char.classId ? storedSpecId : bestSpecFor(character);

  return { character, specId };
}

/** Persist the navbar picker's selection. Throws if the character isn't owned
 * by this user or is hidden. */
export async function setCurrentSelection(userId: string, characterId: string, specId: string): Promise<void> {
  const owned = await prisma.character.findFirst({ where: { id: characterId, userId, bucket: { not: "hidden" } } });
  if (!owned) throw new Error("Character not found, not owned, or hidden");
  await prisma.user.update({ where: { id: userId }, data: { currentCharacterId: characterId, currentSpecId: specId } });
}
