"use client";

import { useEffect, useState } from "react";
import { CharacterCard, type CardCharacter } from "@/components/CharacterCard";

/** Read-only past-season roster snapshot - reuses the same CharacterCard the
 * live Characters view and public profile use, just fed frozen
 * CharacterSeasonSnapshot data instead of the live Character rows (see
 * GET /api/profile/history). Rendered by ProfileClient in place of
 * CharacterBoard whenever the page's season selector isn't on the current
 * season. */
export function SeasonSnapshotGrid({ seasonId }: { seasonId: string }) {
  const [characters, setCharacters] = useState<CardCharacter[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setCharacters(null);
    fetch(`/api/profile/history?season=${encodeURIComponent(seasonId)}`)
      .then((res) => res.json())
      .then((json: { characters: CardCharacter[] }) => setCharacters(json.characters))
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
  }, [seasonId]);

  if (loading) return <div className="panel p-10 text-center text-gray-500">Loading…</div>;

  if (!characters || characters.length === 0) {
    return <div className="panel p-10 text-center text-gray-500">No snapshot for this season yet.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {characters.map((c) => (
        <CharacterCard key={c.id} character={c} dungeonsDefaultOpen showProfileLinks />
      ))}
    </div>
  );
}
