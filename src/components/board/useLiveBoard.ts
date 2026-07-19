"use client";

import { useCallback, useEffect, useState } from "react";
import type { GroupDTO } from "@/data/dto";

/** The live-board SSE subscription shared by BoardClient and
 * RaidBoardClient: full board state, a `live` connection flag, and the
 * optimistic delist removal (the board otherwise only updates on the 4s SSE
 * tick, which made a just-delisted card visibly linger).
 *
 * Each incoming frame is reconciled against the previous one: a group whose
 * serialized content hasn't changed keeps its previous object identity, so
 * a memoized GroupCard actually skips re-rendering on the ticks (the common
 * case) instead of being invalidated by a wholesale-replaced array every 4s.
 * Parse errors stay silently dropped - same as the old inline handler; the
 * next frame self-corrects. */
export function useLiveBoard(initial: GroupDTO[]) {
  const [groups, setGroups] = useState<GroupDTO[]>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/stream/board");
    es.addEventListener("board", (e) => {
      try {
        const next: GroupDTO[] = JSON.parse((e as MessageEvent).data).groups;
        setGroups((prev) => reconcile(prev, next));
        setLive(true);
      } catch {}
    });
    es.onerror = () => setLive(false);
    return () => es.close();
  }, []);

  const removeGroup = useCallback(
    (groupId: string) => setGroups((prev) => prev.filter((g) => g.id !== groupId)),
    []
  );

  return { groups, live, removeGroup };
}

/** Keeps previous object references for unchanged groups; returns `prev`
 * itself when nothing changed at all. Serialized comparison is faithful
 * here because both sides are JSON-born from the same server mapper. */
function reconcile(prev: GroupDTO[], next: GroupDTO[]): GroupDTO[] {
  const prevById = new Map(prev.map((g) => [g.id, g]));
  let changed = prev.length !== next.length;
  const out = next.map((g, i) => {
    const old = prevById.get(g.id);
    if (old && JSON.stringify(old) === JSON.stringify(g)) {
      if (old !== prev[i]) changed = true; // same content, moved position
      return old;
    }
    changed = true;
    return g;
  });
  return changed ? out : prev;
}
