import { getLiveStreamInfo } from "@/data/twitch";

/** The inline "LIVE" chip next to a profile's twitch.tv link - meant to be
 * passed as ProfileOverview's `twitchLiveBadge` slot, wrapped in its own
 * <Suspense fallback={null}> so the Twitch API check doesn't block the rest
 * of the profile. getLiveStreamInfo is React-cached, so this shares the same
 * Helix call as TwitchLivePreviewGate within one request. */
export async function TwitchLiveBadge({ twitch }: { twitch: string | null }) {
  if (!twitch) return null;
  const live = await getLiveStreamInfo(twitch).catch(() => null);
  if (!live) return null;
  return (
    <span className="chip bg-rose-600 text-white text-[9px] px-1.5 py-0 flex items-center gap-1 ml-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  );
}
