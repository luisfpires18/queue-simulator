// Blizzard title ids representing an M+ Rank-1/Hall-of-Fame-style title -
// same hand-maintained, verify-before-relying-on-it convention as
// RaidDef.mythicRange in raidSeason.ts. Blizzard's Titles API
// (src/data/blizzardApp.ts's fetchCharacterTitles) returns every title id
// the character has ever unlocked (account-wide) with no "this one is the
// season R1 title" flag, so there's no way to derive this list from the API
// response itself - it has to be hand-entered per season as ids are
// datamined/verified against a primary source.
//
// Starts empty: ship the feature structurally complete (the count just
// renders as 0/hidden) rather than block on data entry. Fill in real ids
// here as they're confirmed.
export const MPLUS_R1_TITLE_IDS: number[] = [];
