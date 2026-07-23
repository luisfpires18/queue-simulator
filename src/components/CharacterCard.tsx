"use client";

import { CLASS_BY_ID, type ClassId } from "@/game/classes";
import { classIconSlug } from "@/game/icons";
import { ratingTier } from "@/game/season";
import { WowIcon } from "./WowIcon";
import { SpecIcon } from "./SpecIcon";
import { ProfileLinkBadges, CopyNameButton } from "./ProfileLinks";
import { cn } from "@/lib/utils";
import type { DungeonBestRun, RaidKillDTO } from "@/data/dto";
import { DungeonGrid } from "./DungeonGrid";
import { RaidBossGrid } from "./RaidBossGrid";

export interface CardSpecTrack {
  specId: string;
  role: string;
  points: number | null;
  bnetScore: number | null;
  isMain?: boolean;
  bestRuns?: DungeonBestRun[];
}
export interface CardCharacter {
  id: string;
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  level: number;
  ilvl: number | null;
  rating: number | null;
  isMain: boolean;
  bucket: string;
  specTracks: CardSpecTrack[];
  raidKills: RaidKillDTO[];
  /** See RaidBossGrid's own doc comment - only used when raidKills is empty. */
  raidProgressFallback?: { killed: number; total: number } | null;
}

/**
 * bnetScore is really raider.io's real per-spec Mythic+ score now (see
 * src/data/raiderio.ts) — a spec with zero score this season just has no
 * entry, so "no data" here is honest, not a placeholder guess.
 */
function specDisplayRating(track: CardSpecTrack | undefined): number | null {
  return track?.bnetScore ?? track?.points ?? null;
}

// One character, everywhere it's shown — the roster board (interactive) and
// the public profile (read-only) render the exact same card so a visual
// change only ever needs to happen in one place.
export function CharacterCard({
  character: c,
  dragging = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDropOn,
  onSetMain,
  onRefresh,
  refreshing = false,
  onSetMainSpec,
  dungeonsDefaultOpen = false,
  showProfileLinks = false,
}: {
  character: CardCharacter;
  dragging?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDropOn?: () => void;
  onSetMain?: () => void;
  /** Refreshes M+ rating (Blizzard/raider.io/WCL) AND raid boss kills (WCL) -
   * one button, both data sources (see CharacterBoard.tsx's refreshAll). */
  onRefresh?: () => void;
  refreshing?: boolean;
  onSetMainSpec?: (specId: string) => void;
  dungeonsDefaultOpen?: boolean;
  /** Raider.IO/Warcraft Logs links + copy-name button — public profile only,
   * not the private roster board (same shared card, different context). */
  showProfileLinks?: boolean;
}) {
  const cls = CLASS_BY_ID[c.classId as ClassId];
  const trackBySpec = new Map(c.specTracks.map((t) => [t.specId, t]));
  const specs = [...(cls?.specs ?? [])].sort((a, b) => {
    const mainDiff = (trackBySpec.get(b.id)?.isMain ? 1 : 0) - (trackBySpec.get(a.id)?.isMain ? 1 : 0);
    if (mainDiff !== 0) return mainDiff;
    return (specDisplayRating(trackBySpec.get(b.id)) ?? -1) - (specDisplayRating(trackBySpec.get(a.id)) ?? -1);
  });
  const editingSpecs = Boolean(onSetMainSpec);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={
        draggable
          ? (e) => {
              e.stopPropagation();
              onDropOn?.();
            }
          : undefined
      }
      className={`rounded-lg border border-panelborder bg-panel2/40 p-3 flex flex-col items-center gap-2 relative transition-opacity ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      {draggable && (
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-gray-600 text-xs leading-none select-none" title="Drag to reorder or move between sections">
          ⠿
        </span>
      )}
      {c.isMain && !onSetMain && (
        <span className={cn("absolute top-2 text-gold text-lg leading-none", showProfileLinks ? "left-2" : "right-2")}>★</span>
      )}
      {onSetMain && c.bucket === "main" && (
        <button
          onClick={onSetMain}
          title={c.isMain ? "Main" : "Set as the real main"}
          className={cn(
            "absolute top-2 text-lg leading-none",
            showProfileLinks ? "left-2" : "right-2",
            c.isMain ? "text-gold" : "text-gray-600 hover:text-gold"
          )}
        >
          {c.isMain ? "★" : "☆"}
        </button>
      )}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh M+ rating and raid boss kills"
          className="absolute top-2 left-2 text-gray-400 hover:text-accent text-base leading-none disabled:opacity-50"
        >
          {refreshing ? "…" : "↻"}
        </button>
      )}
      {showProfileLinks && (
        <div className="absolute top-2 right-2 z-10">
          <div className="relative">
            <ProfileLinkBadges name={c.name} realmSlug={c.realmSlug} region={c.region} />
          </div>
        </div>
      )}

      <WowIcon slug={classIconSlug(c.classId)} size={56} fallbackColor={cls?.color} />

      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm font-bold truncate max-w-[9rem]" style={{ color: cls?.color }}>{c.name}</span>
          {showProfileLinks && <CopyNameButton name={c.name} realm={c.realm} size="xs" />}
        </div>
        <div className="text-[11px] text-gray-500">{c.realm}</div>
        <div className="text-[11px] text-gray-400">
          {c.rating != null ? (
            <b style={{ color: ratingTier(c.rating).hex }}>{Math.round(c.rating).toLocaleString("en-US")}</b>
          ) : (
            <span className="text-gray-300">lvl {c.level}</span>
          )}
          {c.ilvl != null && <> · {c.ilvl} ilvl</>}
        </div>
      </div>

      {/* specs, ranked highest-rating first, rating right-aligned per row */}
      <div className="w-full pt-1.5 border-t border-panelborder/60 flex flex-col gap-0.5">
        {specs.map((s) => {
          const track = trackBySpec.get(s.id);
          const rating = specDisplayRating(track);
          return (
            <div key={s.id} className="flex items-center gap-1.5 text-[11px]">
              <SpecIcon specId={s.id} size={22} showRole={false} dim={rating == null} />
              <span className="truncate flex-1 text-gray-300">{s.name}</span>
              {editingSpecs && (
                <button
                  onClick={() => onSetMainSpec!(s.id)}
                  title="Set as main spec"
                  className={cn(
                    "text-sm leading-none",
                    track?.isMain ? "text-gold" : "text-gray-600 hover:text-gold"
                  )}
                >
                  {track?.isMain ? "★" : "☆"}
                </button>
              )}
              <span
                className={rating != null ? "font-semibold text-gray-200 tabular-nums" : "text-gray-600"}
                title={rating == null ? "No completed keys logged on this spec this season" : undefined}
              >
                {rating != null ? Math.round(rating).toLocaleString("en-US") : "-"}
              </span>
            </div>
          );
        })}
      </div>

      <DungeonGrid classId={c.classId} specTracks={c.specTracks} defaultOpen={dungeonsDefaultOpen} />
      <RaidBossGrid raidKills={c.raidKills} syncable={Boolean(onRefresh)} raidProgressFallback={c.raidProgressFallback} />
    </div>
  );
}
