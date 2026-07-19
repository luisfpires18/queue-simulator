import Link from "next/link";
import type { SpecTrackDTO, RaidKillDTO } from "@/data/dto";
import { CLASS_BY_ID, specById, type ClassId } from "@/game/classes";
import { trackScore, pickMainTrack } from "@/game/rating";
import { countryByCode, flagUrl } from "@/game/countries";
import { RatingBadge } from "./RatingBadge";
import { SpecIcon } from "./SpecIcon";
import { ProfileLinkIcons, CopyNameButton } from "./ProfileLinks";
import { DungeonGrid } from "./DungeonGrid";
import { RaidBossGrid } from "./RaidBossGrid";

/** Score + best-runs summary for one character — shown for a key's
 * owner/accepted members (click their filled slot) and for each pending
 * applicant. `specId` is the spec they're bringing to *this* key; if that
 * differs from their curated main spec, both scores are shown (Main vs. Off)
 * so the owner can see how much weaker/stronger the applied spec is. Pure
 * presentational; callers fetch the data. */
export function RatingDetails({
  name, realm, realmSlug, region, classId, ilvl, specId, specTracks, forDungeonId, dungeonGridDefaultOpen, raidKills = [], raidGridDefaultOpen, meetsRequirement = null, country = null, headerSize = "compact",
}: {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  ilvl?: number | null;
  specId: string;
  specTracks: SpecTrackDTO[];
  forDungeonId?: string;
  dungeonGridDefaultOpen?: boolean;
  raidKills?: RaidKillDTO[];
  raidGridDefaultOpen?: boolean;
  /** null = the listing has no applicant requirement; otherwise whether this
   * character meets it (advisory only, see src/game/achievements.ts). */
  meetsRequirement?: boolean | null;
  /** ISO 3166-1 alpha-2, from the owning account's Settings tab - same flag
   * shown on the public profile page. Null shows nothing, no layout gap. */
  country?: string | null;
  /** "large" = the standalone player modal header (bigger identity block +
   * a View-profile action row); "compact" = the inline row used in the
   * pending-applicants list, unchanged. */
  headerSize?: "compact" | "large";
}) {
  const cls = CLASS_BY_ID[classId as ClassId];
  const spec = specById(specId);

  const appliedTrack = specTracks.find((t) => t.specId === specId) ?? null;
  const mainTrack = pickMainTrack(specTracks);
  const showSplit = mainTrack != null && mainTrack.specId !== specId;

  const requirementBadge = meetsRequirement != null && (
    <span
      className="shrink-0 text-sm leading-none"
      title={meetsRequirement ? "Meets this listing's applicant requirement" : "Doesn't meet this listing's applicant requirement"}
    >
      {meetsRequirement ? "✅" : "⚠️"}
    </span>
  );

  const ratingBlock = (badgeSize: "sm" | "md") =>
    showSplit ? (
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1" title="Their curated main spec's rating">
          <SpecIcon specId={mainTrack.specId} size={16} showRole={false} />
          {trackScore(mainTrack) != null ? (
            <RatingBadge rating={Math.round(trackScore(mainTrack)!)} size={badgeSize} />
          ) : (
            <span className="text-xs text-gray-600">Unranked</span>
          )}
        </div>
        <div className="flex items-center gap-1" title="The spec they're bringing here">
          <SpecIcon specId={specId} size={16} showRole={false} />
          {trackScore(appliedTrack) != null ? (
            <RatingBadge rating={Math.round(trackScore(appliedTrack)!)} size={badgeSize} />
          ) : (
            <span className="text-xs text-gray-600">Unranked</span>
          )}
        </div>
      </div>
    ) : trackScore(appliedTrack ?? mainTrack) != null ? (
      <RatingBadge rating={Math.round(trackScore(appliedTrack ?? mainTrack)!)} size={badgeSize} />
    ) : (
      <span className="text-xs text-gray-600">Unranked</span>
    );

  const flag = country && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flagUrl(country)} width={18} height={13} alt="" title={countryByCode(country)?.name ?? country} className="rounded-[2px]" />
  );

  return (
    <div className="space-y-2">
      {headerSize === "large" ? (
        <div className="rounded-lg border border-panelborder bg-panel2/40 p-3 space-y-3">
          {/* identity: big spec icon, name in class colour, realm/spec/ilvl line */}
          <div className="flex items-center gap-3">
            <SpecIcon specId={specId} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black leading-tight truncate" style={{ color: cls?.color }}>{name}</span>
                {flag}
                {requirementBadge}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {realm} · {spec?.name}
                {ilvl != null && <> · {ilvl} ilvl</>}
              </div>
            </div>
            {ratingBlock("md")}
          </div>

          {/* actions: in-app profile + external profiles + copy for /invite */}
          <div className="flex items-center gap-2 pt-2.5 border-t border-panelborder/60">
            <Link
              href={`/u/${realmSlug}/${encodeURIComponent(name)}`}
              className="chip border border-accent/50 text-accent hover:bg-accent/10"
              title="Open this player's profile page"
            >
              View profile →
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <ProfileLinkIcons name={name} realmSlug={realmSlug} region={region} />
              <CopyNameButton name={name} realm={realm} size="sm" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <SpecIcon specId={specId} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold truncate" style={{ color: cls?.color }}>{name}</span>
              {flag}
              <CopyNameButton name={name} realm={realm} size="xs" />
              <ProfileLinkIcons name={name} realmSlug={realmSlug} region={region} />
            </div>
            <div className="text-[11px] text-gray-500">
              {realm} · {spec?.name}
              {ilvl != null && <> · {ilvl} ilvl</>}
            </div>
          </div>

          {requirementBadge}
          {ratingBlock("sm")}
        </div>
      )}

      <DungeonGrid
        classId={classId}
        specTracks={specTracks}
        initialSpecId={specId}
        highlightDungeonId={forDungeonId}
        defaultOpen={dungeonGridDefaultOpen}
      />
      <RaidBossGrid raidKills={raidKills} defaultOpen={raidGridDefaultOpen} />
    </div>
  );
}
