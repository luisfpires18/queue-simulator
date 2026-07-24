import type { TwitchLiveInfoDTO } from "@/data/dto";

/** The public profile's "they're live right now" card - a thumbnail +
 * title + viewer count linking out to the stream. Only ever rendered when
 * getLiveStreamInfo actually returned something (see the public profile
 * page), so there's no loading/offline state to handle here. */
export function TwitchLivePreview({ twitch, live }: { twitch: string; live: TwitchLiveInfoDTO }) {
  return (
    <a
      href={`https://twitch.tv/${twitch}`}
      target="_blank"
      rel="noreferrer"
      className="panel p-3 flex gap-3 hover:border-[#a970ff]/50 transition-colors"
    >
      <div className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={live.thumbnailUrl} alt="" className="w-40 h-[90px] rounded-md object-cover bg-panel2" />
        <span className="absolute top-1.5 left-1.5 chip bg-rose-600 text-white text-[10px] px-1.5 py-0 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </span>
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <div className="text-sm font-bold text-gray-100 truncate">{live.title}</div>
        <div className="text-xs text-gray-500 mt-1">
          {live.viewerCount.toLocaleString("en-US")} viewers · twitch.tv/{twitch}
        </div>
      </div>
    </a>
  );
}
