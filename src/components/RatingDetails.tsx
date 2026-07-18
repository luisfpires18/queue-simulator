import type { SpecTrackDTO, RaidKillDTO } from "@/data/source";
import { CLASS_BY_ID, specById, type ClassId } from "@/game/classes";
import { trackScore, pickMainTrack } from "@/game/rating";
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
  name, realm, realmSlug, region, classId, ilvl, specId, specTracks, forDungeonId, dungeonGridDefaultOpen, raidKills = [], meetsRequirement = null,
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
  /** null = the listing has no applicant requirement; otherwise whether this
   * character meets it (advisory only, see src/game/achievements.ts). */
  meetsRequirement?: boolean | null;
}) {
  const cls = CLASS_BY_ID[classId as ClassId];
  const spec = specById(specId);

  const appliedTrack = specTracks.find((t) => t.specId === specId) ?? null;
  const mainTrack = pickMainTrack(specTracks);
  const showSplit = mainTrack != null && mainTrack.specId !== specId;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SpecIcon specId={specId} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold truncate" style={{ color: cls?.color }}>{name}</span>
            <CopyNameButton name={name} realm={realm} size="xs" />
            <ProfileLinkIcons name={name} realmSlug={realmSlug} region={region} />
          </div>
          <div className="text-[11px] text-gray-500">
            {realm} · {spec?.name}
            {ilvl != null && <> · {ilvl} ilvl</>}
          </div>
        </div>

        {meetsRequirement != null && (
          <span
            className="shrink-0 text-sm leading-none"
            title={meetsRequirement ? "Meets this listing's applicant requirement" : "Doesn't meet this listing's applicant requirement"}
          >
            {meetsRequirement ? "✅" : "⚠️"}
          </span>
        )}
        {showSplit ? (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              <SpecIcon specId={mainTrack.specId} size={16} showRole={false} />
              {trackScore(mainTrack) != null ? (
                <RatingBadge rating={Math.round(trackScore(mainTrack)!)} size="sm" />
              ) : (
                <span className="text-xs text-gray-600">Unranked</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <SpecIcon specId={specId} size={16} showRole={false} />
              {trackScore(appliedTrack) != null ? (
                <RatingBadge rating={Math.round(trackScore(appliedTrack)!)} size="sm" />
              ) : (
                <span className="text-xs text-gray-600">Unranked</span>
              )}
            </div>
          </div>
        ) : trackScore(appliedTrack ?? mainTrack) != null ? (
          <RatingBadge rating={Math.round(trackScore(appliedTrack ?? mainTrack)!)} size="sm" />
        ) : (
          <span className="text-xs text-gray-600">Unranked</span>
        )}
      </div>

      <DungeonGrid
        classId={classId}
        specTracks={specTracks}
        initialSpecId={specId}
        highlightDungeonId={forDungeonId}
        defaultOpen={dungeonGridDefaultOpen}
      />
      <RaidBossGrid raidKills={raidKills} />
    </div>
  );
}
