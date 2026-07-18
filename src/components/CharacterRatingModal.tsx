"use client";

import { useEffect } from "react";
import type { CharacterRatingSummaryDTO } from "@/data/source";
import { RatingDetails } from "./RatingDetails";

/** Modal shell around RatingDetails — opened by clicking a filled slot square
 * (the key owner or an accepted member) on a GroupCard. Overlay pattern
 * matches ApplyModal/ConfirmDialog. */
export function CharacterRatingModal({
  open, onClose, specId, forDungeonId, loading, summary,
}: {
  open: boolean;
  onClose: () => void;
  specId: string;
  forDungeonId?: string;
  loading: boolean;
  summary: CharacterRatingSummaryDTO | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="panel w-full max-w-sm max-h-[85vh] overflow-y-auto p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
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
            dungeonGridDefaultOpen
            raidKills={summary.raidKills}
          />
        )}
      </div>
    </div>
  );
}
