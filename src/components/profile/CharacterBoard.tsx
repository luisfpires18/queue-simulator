"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterCard, type CardCharacter, type CardSpecTrack } from "@/components/CharacterCard";

type Character = CardCharacter & { sortOrder: number };

const BUCKETS: { key: string; title: string; hint: string }[] = [
  { key: "main", title: "Main", hint: "Try-hards - only one carries the star" },
  { key: "alt", title: "Alts", hint: "Casual alts" },
  { key: "hidden", title: "Hidden", hint: "Not shown on your public profile" },
];

function defaultSort(a: Character, b: Character) {
  return (b.rating ?? -1) - (a.rating ?? -1) || (b.ilvl ?? -1) - (a.ilvl ?? -1) || b.level - a.level;
}

export function CharacterBoard({ initial }: { initial: Character[] }) {
  const [chars, setChars] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const router = useRouter();

  // Native HTML5 drag-and-drop (the `draggable` attribute + dataTransfer)
  // only works with a mouse - touch devices have no working implementation
  // of it, so a touch-drag on a `draggable` element falls through to the
  // OS's own generic drag gesture instead (confirmed live: dragging a
  // character card on iOS Safari opened a Google search for the character's
  // raw id, which is exactly the dataTransfer text/plain payload dragstart
  // sets below). Disable draggable entirely on coarse-pointer (touch)
  // devices - reordering just isn't available via drag there for now.
  const [touchDevice, setTouchDevice] = useState(false);
  useEffect(() => {
    setTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const grouped = useMemo(() => {
    const byBucket: Record<string, Character[]> = { main: [], alt: [], hidden: [] };
    for (const c of chars) byBucket[c.bucket]?.push(c);
    for (const key of Object.keys(byBucket)) {
      const list = byBucket[key];
      const allZero = list.every((c) => c.sortOrder === 0);
      list.sort(allZero ? defaultSort : (a, b) => a.sortOrder - b.sortOrder);
    }
    return byBucket;
  }, [chars]);

  async function persistOrder(bucket: string, orderedIds: string[]) {
    await fetch("/api/characters/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket, orderedIds }),
    });
  }

  // Pure: no side effects here. setState updaters can run more than once
  // (React Strict Mode's dev double-invoke, concurrent rendering retries) —
  // firing network requests from inside one double-fires them and can leave
  // the persisted order out of sync with what's on screen.
  function computeMove(prev: Character[], draggedId: string, targetBucket: string, targetId: string | null) {
    const dragged = prev.find((c) => c.id === draggedId);
    if (!dragged) return null;
    const withoutDragged = prev.filter((c) => c.id !== draggedId);
    const moved = { ...dragged, bucket: targetBucket };
    const bucketList = withoutDragged.filter((c) => c.bucket === targetBucket);
    const rest = withoutDragged.filter((c) => c.bucket !== targetBucket);
    const idx = targetId ? bucketList.findIndex((c) => c.id === targetId) : bucketList.length;
    bucketList.splice(idx < 0 ? bucketList.length : idx, 0, moved);
    // Stamp the new position onto each item's sortOrder right away — otherwise
    // every character's sortOrder is still whatever it was (often all 0 on a
    // fresh roster), the very next render's "all zero -> sort by rating"
    // fallback in `grouped` snaps the drop right back, and it only sticks once
    // a reload pulls the persisted order back down from the server.
    const reordered = bucketList.map((c, i) => ({ ...c, sortOrder: i }));
    return {
      next: [...rest, ...reordered],
      orderedIds: reordered.map((c) => c.id),
      bucketChanged: dragged.bucket !== targetBucket,
    };
  }

  function dropOnto(targetBucket: string, targetId: string | null) {
    if (!dragId) return;
    const result = computeMove(chars, dragId, targetBucket, targetId);
    const draggedId = dragId;
    setDragId(null);
    if (!result) return;
    setChars(result.next);
    persistOrder(targetBucket, result.orderedIds);
    if (result.bucketChanged) {
      fetch(`/api/characters/${draggedId}/bucket`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket: targetBucket }),
      });
    }
  }

  async function setMain(id: string) {
    await fetch("/api/characters/main", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: id }),
    });
    router.refresh();
    setChars((prev) => prev.map((c) => ({ ...c, isMain: c.id === id, bucket: c.id === id ? "main" : c.bucket })));
  }

  async function setMainSpec(characterId: string, specId: string) {
    const res = await fetch(`/api/characters/${characterId}/specs`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ specId, isMain: true }),
    });
    const tracks: CardSpecTrack[] = await res.json();
    setChars((prev) => prev.map((c) => (c.id === characterId ? { ...c, specTracks: tracks } : c)));
  }

  // One button, both data sources: M+ rating (Blizzard/raider.io + WCL
  // dungeon points) and raid boss kills (WCL) all refresh together.
  async function refreshAll(id: string) {
    setRefreshing(id);
    setRatingError(null);
    try {
      // raider.io gives a real overall + per-spec rating and this season's
      // best runs; Warcraft Logs separately tracks every spec you've logged,
      // so it can fill in a spec raider.io has no M+ data for at all.
      // WCL needs a zone configured — missing one there isn't a real error.
      const [bnetRes, wclRes, raidKillsRes] = await Promise.all([
        fetch(`/api/characters/${id}/rating`, { method: "POST" }),
        fetch(`/api/characters/${id}/wcl-rating`, { method: "POST" }),
        fetch(`/api/characters/${id}/raid-kills/sync`, { method: "POST" }),
      ]);
      const bnetData = await bnetRes.json();
      const wclData = wclRes.ok ? await wclRes.json() : { specScores: [] };
      const raidKillsData = raidKillsRes.ok ? await raidKillsRes.json() : null;
      if (!bnetRes.ok) {
        setRatingError(`${chars.find((c) => c.id === id)?.name ?? "Character"}: ${bnetData.error ?? `HTTP ${bnetRes.status}`}`);
        return;
      }
      setChars((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          let specTracks = mergeSpecScores(
            c.specTracks,
            "bnetScore",
            (bnetData.specScores ?? []).map((s: { specId: string; score: number }) => ({ specId: s.specId, value: s.score }))
          );
          specTracks = mergeSpecScores(
            specTracks,
            "points",
            (wclData.specScores ?? []).map((s: { specId: string; points: number }) => ({ specId: s.specId, value: s.points }))
          );
          const bestRunsBySpec = bnetData.bestRunsBySpec ?? {};
          specTracks = specTracks.map((t) => (t.specId in bestRunsBySpec ? { ...t, bestRuns: bestRunsBySpec[t.specId] } : t));
          return {
            ...c,
            rating: bnetData.overallRating,
            ilvl: bnetData.ilvl ?? c.ilvl,
            specTracks,
            raidKills: raidKillsData?.kills ?? c.raidKills,
          };
        })
      );
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div className="space-y-6">
      {ratingError && (
        <div className="panel p-3 text-sm text-rose-300 flex items-center gap-2">
          {ratingError}
          <button onClick={() => setRatingError(null)} className="ml-auto text-gray-500 hover:text-white">✕</button>
        </div>
      )}
      {BUCKETS.map(({ key, title, hint }) => (
        <div
          key={key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => dropOnto(key, null)}
          className="panel p-4"
        >
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
            <span className="text-xs text-gray-500">{hint}</span>
          </div>
          {grouped[key].length === 0 ? (
            <p className="text-xs text-gray-600 py-4 text-center">Drag a character here</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {grouped[key].map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  draggable={!touchDevice}
                  dragging={dragId === c.id}
                  onDragStart={(e) => {
                    // Firefox (and some Chrome drop targets) won't complete a
                    // drag at all unless dataTransfer carries data from dragstart.
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", c.id);
                    setDragId(c.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  onDropOn={() => dropOnto(key, c.id)}
                  onSetMain={() => setMain(c.id)}
                  onRefresh={() => refreshAll(c.id)}
                  refreshing={refreshing === c.id}
                  onSetMainSpec={(specId) => setMainSpec(c.id, specId)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function mergeSpecScores(
  tracks: CardSpecTrack[],
  field: "bnetScore" | "points",
  scores: { specId: string; value: number }[]
): CardSpecTrack[] {
  const byId = new Map(tracks.map((t) => [t.specId, { ...t }]));
  for (const s of scores) {
    const existing = byId.get(s.specId);
    if (existing) existing[field] = s.value;
    else byId.set(s.specId, { specId: s.specId, role: "DPS", points: null, bnetScore: null, [field]: s.value });
  }
  return [...byId.values()];
}
