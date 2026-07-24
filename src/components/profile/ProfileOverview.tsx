import { CLASS_BY_ID, specById, type ClassId } from "@/game/classes";
import { classIconSlug, MISC_ICON } from "@/game/icons";
import { countryByCode, flagUrl } from "@/game/countries";
import { WowIcon } from "@/components/WowIcon";

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
    <path d="M20.3 5.4A18.3 18.3 0 0 0 15.6 4a13 13 0 0 0-.6 1.2 16.9 16.9 0 0 0-5 0A13 13 0 0 0 9.4 4a18.2 18.2 0 0 0-4.7 1.4C1.8 9.6 1 13.6 1.4 17.6a18.4 18.4 0 0 0 5.6 2.8c.4-.6.8-1.3 1.1-2a12 12 0 0 1-1.8-.9l.4-.3a13.1 13.1 0 0 0 11 0l.4.3c-.6.3-1.2.6-1.8.9.3.7.7 1.4 1.1 2a18.3 18.3 0 0 0 5.6-2.8c.5-4.6-.7-8.6-2.7-12.2ZM8.7 15.2c-.9 0-1.6-.9-1.6-1.9s.7-1.9 1.6-1.9 1.6.9 1.6 1.9-.7 1.9-1.6 1.9Zm6.6 0c-.9 0-1.6-.9-1.6-1.9s.7-1.9 1.6-1.9 1.6.9 1.6 1.9-.7 1.9-1.6 1.9Z" />
  </svg>
);

const TwitchIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
    <path d="M4.5 2 3 5.5v14h5V22l3-2.5h4L20.5 15V2H4.5Zm14.5 12-3 3h-4l-3 2.5V17H5.5V4h13.5v10Z" />
    <path d="M15.5 7h1.8v5h-1.8V7Zm-4.7 0h1.8v5h-1.8V7Z" />
  </svg>
);

export function ProfileOverview({
  battletag, memberSince, characterCount, main, highestRating = null, country = null, live = false, r1Titles = null, discord = null, twitch = null, twitchLive = false,
}: {
  battletag: string | null;
  /** null for a live (unregistered) snapshot - there's no account to have joined */
  memberSince: string | null;
  /** null for a live (unregistered) snapshot */
  characterCount: number | null;
  /** Identity block only (avatar/name/class/spec) - always the designated
   * main character, independent of which character actually holds
   * `highestRating` below. */
  main: { name: string; classId: string; specId: string | null } | null;
  /** MAX(rating) across every character on the account, not just `main`'s -
   * a DH main with a higher-rated DK alt shows the DK's number here. Null
   * hides the stat (no rated character at all). */
  highestRating?: number | null;
  /** ISO 3166-1 alpha-2 code, set from the Settings tab - null shows nothing, no layout reservation */
  country?: string | null;
  /** True for an unregistered character's live raider.io-only snapshot - no
   * account/battletag/join-date exists, so those stats are hidden rather
   * than faked, and a small inline chip marks the data as live instead of a
   * separate banner. */
  live?: boolean;
  /** Account-wide count of M+ Rank-1/Hall-of-Fame-style titles held (see
   * src/game/mplusTitles.ts). Null hides the stat - either a Blizzard fetch
   * failure, or genuinely not yet computed - distinct from a real 0. */
  r1Titles?: number | null;
  /** Set from the Settings tab - null shows nothing, same as country. */
  discord?: string | null;
  /** Twitch channel login - rendered as a twitch.tv/<this> link. */
  twitch?: string | null;
  /** Whether that channel is live right now (see getLiveStreamInfo) - just
   * adds a "LIVE" badge next to the link here; the actual preview thumbnail
   * is its own card, see TwitchLivePreview.tsx. */
  twitchLive?: boolean;
}) {
  const cls = main ? CLASS_BY_ID[main.classId as ClassId] : null;
  const spec = main?.specId ? specById(main.specId) : null;
  const since = memberSince
    ? new Date(memberSince).toLocaleDateString("en-US", { year: "numeric", month: "short" })
    : null;

  return (
    <div className="panel p-4 flex flex-wrap items-center gap-6">
      {main && (
        <div className="flex items-center gap-2">
          <WowIcon slug={classIconSlug(main.classId)} size={40} fallbackColor={cls?.color} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold" style={{ color: cls?.color }}>{main.name}</span>
              {country && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flagUrl(country)} width={18} height={13} alt="" title={countryByCode(country)?.name ?? country} className="rounded-[2px]" />
              )}
              {live && (
                <span className="chip border border-panelborder text-gray-500 text-[9px] px-1.5 py-0" title="Not a synced account on this app - showing raider.io's public data only.">
                  Live
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500">{spec?.name ?? "-"} {cls?.name}</div>
            {(discord || twitch) && (
              <div className="flex items-center gap-3 mt-1">
                {discord && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400" title="Discord">
                    <DiscordIcon />
                    {discord}
                  </span>
                )}
                {twitch && (
                  <a
                    href={`https://twitch.tv/${twitch}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-[#a970ff] hover:underline"
                    title="Twitch"
                  >
                    <TwitchIcon />
                    {twitch}
                    {twitchLive && (
                      <span className="chip bg-rose-600 text-white text-[9px] px-1.5 py-0 flex items-center gap-1 ml-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {!live && battletag && <Stat icon={MISC_ICON.identity} label="Battletag" value={battletag} />}
      {!live && since && <Stat icon={MISC_ICON.clock} label="Member since" value={since} />}
      {!live && characterCount != null && <Stat icon={MISC_ICON.roster} label="Characters" value={String(characterCount)} />}
      {highestRating != null && (
        <Stat icon={MISC_ICON.keystone} label="Highest Rating" value={Math.round(highestRating).toLocaleString("en-US")} accent />
      )}
      {r1Titles != null && (
        <Stat icon={MISC_ICON.keystone} label="M+ R1 Titles" value={String(r1Titles)} accent={r1Titles > 0} />
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent = false }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <WowIcon slug={icon} size={24} cdnSize="small" rounded="sm" className="opacity-70" />
      <div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className={accent ? "text-sm font-bold text-accent tabular-nums" : "text-sm font-semibold text-gray-200"}>{value}</div>
      </div>
    </div>
  );
}
