// User row materialization + the navbar's global current-character selection.
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { bestSpecFor } from "@/game/roster";
import { specById } from "@/game/classes";
import type { CurrentSelectionDTO, RosterCharacterDTO } from "./dto";
import { getSpecTracks, getUserCharacters } from "./characters";

/** Whether a stored battletag actually needs rewriting. Pure so the rule is
 * unit-testable (see users.test.ts). An absent incoming value never wipes a
 * stored one - the session simply didn't carry it. */
export function needsBattletagWrite(stored: string | null, incoming?: string): boolean {
  if (incoming == null) return false;
  return stored !== incoming;
}

/**
 * Materializes the User row for a Battle.net id.
 *
 * Read-first, not a blind upsert: this runs on EVERY authenticated request
 * (see getSessionUser), and an upsert always takes SQLite's database-level
 * write lock, serialising every concurrent API call on a board page behind
 * each other. The battletag changes approximately never, so the write is
 * skipped unless it genuinely differs.
 */
export async function ensureUser(bnetId: string, battletag?: string) {
  const existing = await prisma.user.findUnique({ where: { bnetId } });
  if (!existing) return prisma.user.create({ data: { bnetId, battletag } });
  if (!needsBattletagWrite(existing.battletag, battletag)) return existing;
  return prisma.user.update({ where: { bnetId }, data: { battletag } });
}

/** Resolve this user's stored current-character selection against their live,
 * non-hidden roster. Falls back to (isMain ?? first) character and
 * bestSpecFor() when unset, or when the stored id/spec no longer resolves
 * (deleted, moved to hidden, spec no longer tracked). Null only when the user
 * has zero selectable (non-hidden) characters.
 *
 * React-cached per request - getUserCharacters is itself cached, so this no
 * longer needs a "known roster" shortcut param; every caller in one render
 * (AccountMenu, a board page) shares both layers of memoization. */
export const getCurrentSelection = cache(async (userId: string): Promise<CurrentSelectionDTO | null> => {
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
  // AccountMenuClient.tsx), so requiring a pre-existing track here made
  // an untracked-but-legitimate pick (e.g. Guardian on a resto-only-tracked
  // druid) silently revert to bestSpecFor() on the very next read.
  const storedSpecId = char.id === user?.currentCharacterId ? user?.currentSpecId ?? null : null;
  const specId = storedSpecId && specById(storedSpecId)?.classId === char.classId ? storedSpecId : bestSpecFor(character);

  return { character, specId };
});

/** Persist the navbar picker's selection. Throws if the character isn't owned
 * by this user or is hidden. */
export async function setCurrentSelection(userId: string, characterId: string, specId: string): Promise<void> {
  const owned = await prisma.character.findFirst({ where: { id: characterId, userId, bucket: { not: "hidden" } } });
  if (!owned) throw new Error("Character not found, not owned, or hidden");
  await prisma.user.update({ where: { id: userId }, data: { currentCharacterId: characterId, currentSpecId: specId } });
}
