import { getLiveStreamInfo } from "@/data/twitch";
import { TwitchLivePreview } from "./TwitchLivePreview";

/** Resolves the Twitch live check and renders the preview card if live -
 * meant to be wrapped in its own <Suspense fallback={null}> so the profile
 * page's shell doesn't wait on the Helix call. getLiveStreamInfo is
 * React-cached, so this shares the same call as TwitchLiveBadge within one
 * request. */
export async function TwitchLivePreviewGate({ twitch }: { twitch: string | null }) {
  if (!twitch) return null;
  const live = await getLiveStreamInfo(twitch).catch(() => null);
  if (!live) return null;
  return <TwitchLivePreview twitch={twitch} live={live} />;
}
