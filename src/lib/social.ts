// Pure input-normalization for the profile Settings tab's Discord/Twitch
// fields — lets someone paste a full profile URL and still get a clean
// stored value. Both return null for an empty/whitespace-only input, same
// "empty = unset" convention as Country.

const TWITCH_MAX_LEN = 25; // Twitch's own username length cap
const DISCORD_MAX_LEN = 40; // generous - covers both legacy "name#0001" and new "@name" formats

/** "https://www.twitch.tv/some_streamer" / "twitch.tv/some_streamer" / "@some_streamer" -> "some_streamer". */
export function normalizeTwitchHandle(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withoutUrl = trimmed.replace(/^https?:\/\//i, "").replace(/^(www\.)?twitch\.tv\//i, "");
  const handle = withoutUrl.replace(/^@/, "").split(/[/?#]/)[0].toLowerCase();
  return handle ? handle.slice(0, TWITCH_MAX_LEN) : null;
}

/** "@username" -> "username"; legacy "Name#1234" is left as-is. */
export function normalizeDiscordHandle(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, "");
  return trimmed ? trimmed.slice(0, DISCORD_MAX_LEN) : null;
}
