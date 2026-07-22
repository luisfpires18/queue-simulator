import { CLASS_BY_ID, specById, type ClassId } from "@/game/classes";
import { classIconSlug, MISC_ICON } from "@/game/icons";
import { countryByCode, flagUrl } from "@/game/countries";
import { WowIcon } from "@/components/WowIcon";

export function ProfileOverview({
  battletag, memberSince, characterCount, main, country = null, live = false, r1Titles = null,
}: {
  battletag: string | null;
  /** null for a live (unregistered) snapshot - there's no account to have joined */
  memberSince: string | null;
  /** null for a live (unregistered) snapshot */
  characterCount: number | null;
  main: { name: string; classId: string; specId: string | null; rating: number | null } | null;
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
          </div>
        </div>
      )}
      {!live && <Stat icon={MISC_ICON.identity} label="Battletag" value={battletag ?? "-"} />}
      {!live && since && <Stat icon={MISC_ICON.clock} label="Member since" value={since} />}
      {!live && characterCount != null && <Stat icon={MISC_ICON.roster} label="Characters" value={String(characterCount)} />}
      {main?.rating != null && (
        <Stat icon={MISC_ICON.keystone} label="Main rating" value={Math.round(main.rating).toLocaleString("en-US")} accent />
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
