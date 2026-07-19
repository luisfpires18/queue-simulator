"use client";

import type { CharacterRatingSummaryDTO } from "@/data/dto";
import { Modal } from "./ui/Modal";
import { RatingDetails } from "./RatingDetails";

/** Modal shell around RatingDetails — opened by clicking a filled slot square
 * (the key owner or an accepted member) on a GroupCard. Overlay pattern
 * matches ApplyModal/ConfirmDialog. */
export function CharacterRatingModal({
  open, onClose, specId, forDungeonId, loading, summary, context = "mplus",
}: {
  open: boolean;
  onClose: () => void;
  specId: string;
  forDungeonId?: string;
  loading: boolean;
  summary: CharacterRatingSummaryDTO | null;
  /** Which board opened this - the matching section starts expanded and the
   * other collapsed (an M+ card's viewer cares about keys first, a raid
   * card's viewer about boss kills). */
  context?: "mplus" | "raid";
}) {
  return (
    <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Rating details</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>

      {loading || !summary ? (
        <p className="text-sm text-gray-500 py-4 text-center">{loading ? "Loading…" : "Not found."}</p>
      ) : (
        <RatingDetails
          name={summary.name}
          realm={summary.realm}
          realmSlug={summary.realmSlug}
          region={summary.region}
          classId={summary.classId}
          ilvl={summary.ilvl}
          specId={specId}
          specTracks={summary.specTracks}
          forDungeonId={forDungeonId}
          dungeonGridDefaultOpen={context === "mplus"}
          raidKills={summary.raidKills}
          raidGridDefaultOpen={context === "raid"}
          country={summary.country}
          headerSize="large"
        />
      )}
    </Modal>
  );
}
