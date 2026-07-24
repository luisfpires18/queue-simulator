// Live-status lookup for a linked Twitch channel (public profile preview
// card). Best-effort like fetchR1TitleCount in the public profile page - a
// Twitch hiccup or unconfigured credentials should just hide the preview,
// never fail the whole profile.
import { getTwitchToken, twitchEnabled } from "@/server/twitch/auth";
import type { TwitchLiveInfoDTO } from "./dto";

const STREAMS_URL = "https://api.twitch.tv/helix/streams";
const THUMBNAIL_WIDTH = 440;
const THUMBNAIL_HEIGHT = 248;

interface HelixStream {
  title: string;
  viewer_count: number;
  thumbnail_url: string;
}

/** Null when the channel isn't live, TWITCH_CLIENT_ID/SECRET aren't
 * configured, or the Helix call fails - all treated the same by callers
 * (fall back to a plain twitch.tv/<login> link). */
export async function getLiveStreamInfo(login: string): Promise<TwitchLiveInfoDTO | null> {
  if (!twitchEnabled()) return null;

  try {
    const token = await getTwitchToken();
    const res = await fetch(`${STREAMS_URL}?user_login=${encodeURIComponent(login)}`, {
      headers: { "Client-Id": process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const body: { data: HelixStream[] } = await res.json();
    const stream = body.data[0];
    if (!stream) return null;

    return {
      title: stream.title,
      viewerCount: stream.viewer_count,
      thumbnailUrl: stream.thumbnail_url.replace("{width}", String(THUMBNAIL_WIDTH)).replace("{height}", String(THUMBNAIL_HEIGHT)),
    };
  } catch (err) {
    console.error("getLiveStreamInfo failed", err);
    return null;
  }
}
