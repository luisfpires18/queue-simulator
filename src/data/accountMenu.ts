// Aggregates everything the header's AccountMenu needs into one React-cached
// call. Wrapping the whole sequence (not just the leaf functions) matters
// because getSpecTracksByCharacter takes a freshly-built id array each call -
// cache() keys on argument identity, so only a single call keyed on the
// primitive userId reliably dedupes across the layout's two AccountMenu
// renders (desktop header + mobile drawer).
import { cache } from "react";
import type { ChatGroupSummaryDTO, CurrentSelectionDTO, FriendDTO, FriendRequestDTO, RosterCharacterDTO } from "./dto";
import { getCurrentSelection } from "./users";
import { getUserCharacters, getSpecTracksByCharacter } from "./characters";
import { listFriends, listIncomingRequests, listOutgoingRequests } from "./network";
import { listMyChatGroups } from "./chatGroups";
import { getCurrentSeasonId } from "./appSettings";

export interface AccountMenuData {
  characters: RosterCharacterDTO[];
  current: CurrentSelectionDTO | null;
  friends: FriendDTO[];
  incoming: FriendRequestDTO[];
  outgoing: FriendRequestDTO[];
  chatGroups: ChatGroupSummaryDTO[];
  currentSeasonId: string;
}

export const getAccountMenuData = cache(async (userId: string): Promise<AccountMenuData> => {
  const chars = (await getUserCharacters(userId)).filter((c) => c.bucket !== "hidden");
  // One batched query for every character's spec tracks, not one per
  // character - this blocks the header HTML, so it blocks everything.
  const tracksByChar = await getSpecTracksByCharacter(chars.map((c) => c.id));
  const characters = chars.map((c) => ({ ...c, specTracks: tracksByChar.get(c.id) ?? [] }));
  const [current, friends, incoming, outgoing, chatGroups, currentSeasonId] = await Promise.all([
    getCurrentSelection(userId),
    listFriends(userId),
    listIncomingRequests(userId),
    listOutgoingRequests(userId),
    listMyChatGroups(userId),
    getCurrentSeasonId(),
  ]);
  return { characters, current, friends, incoming, outgoing, chatGroups, currentSeasonId };
});
