"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CurrentSelectionDTO, FriendDTO, RosterCharacterDTO } from "@/data/dto";
import { CLASS_BY_ID, classById, type ClassId } from "@/game/classes";
import type { SeasonDef } from "@/game/season";
import { bestSpecFor } from "@/game/roster";
import { classIconSlug } from "@/game/icons";
import { WowIcon } from "./WowIcon";
import { SpecIcon } from "./SpecIcon";
import { useFriendRequests, useFriends, type FriendRequestsResponse } from "@/lib/queries";
import { useNetworkStream } from "./network/useNetworkStream";
import { cn } from "@/lib/utils";

const ChevronRightIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-500 shrink-0">
    <path d="M6 4l4.5 4L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Every spec of the character's class - always selectable, even one never
 * synced a rating for (no reason to force "set main" first just to unlock
 * picking it). Main spec pinned first, rest by score desc when tracked. */
function specsFor(character: RosterCharacterDTO) {
  const allSpecs = classById(character.classId)?.specs ?? [];
  const trackById = new Map(character.specTracks.map((t) => [t.specId, t]));
  return [...allSpecs].sort((a, b) => {
    const ta = trackById.get(a.id);
    const tb = trackById.get(b.id);
    const mainDiff = (tb?.isMain ? 1 : 0) - (ta?.isMain ? 1 : 0);
    if (mainDiff !== 0) return mainDiff;
    return (tb?.bnetScore ?? tb?.points ?? -1) - (ta?.bnetScore ?? ta?.points ?? -1);
  });
}

/** The single header account dropdown: current-character/spec picker,
 * Network status, and account/logout — one trigger button instead of three
 * separate chips. */
export function AccountMenuClient({
  characters, current, displayName, battletag, initialFriends, initialRequests, season, onLogout,
}: {
  characters: RosterCharacterDTO[];
  current: CurrentSelectionDTO | null;
  displayName: string;
  battletag: string | null;
  initialFriends: FriendDTO[];
  initialRequests: FriendRequestsResponse;
  season: SeasonDef;
  onLogout: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(current?.character.classId ?? characters[0]?.classId ?? "");
  const [charId, setCharId] = useState(current?.character.id ?? characters[0]?.id ?? "");
  const [specId, setSpecId] = useState(current?.specId ?? (characters[0] ? bestSpecFor(characters[0]) : ""));
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useNetworkStream();
  const { data: friends } = useFriends(initialFriends);
  const onlineCount = (friends ?? initialFriends).filter((f) => f.online).length;
  // Live, not the SSR snapshot — useNetworkStream invalidates this query on
  // every friend_request/friend_resolved event, so accepting/declining
  // updates the badge immediately instead of only on the next navigation.
  const { data: requests } = useFriendRequests(initialRequests);
  const pendingCount = (requests ?? initialRequests).incoming.length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const classIds = useMemo(() => {
    const seen: string[] = [];
    for (const c of characters) if (!seen.includes(c.classId)) seen.push(c.classId);
    return seen;
  }, [characters]);

  // Same character name can exist on different realms - without this, two
  // "Unreally" buttons side by side are indistinguishable.
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of characters) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    return new Set([...counts].filter(([, n]) => n > 1).map(([name]) => name));
  }, [characters]);

  const hasCharacters = characters.length > 0;
  const charsOfClass = characters.filter((c) => c.classId === classId);
  const owner = characters.find((c) => c.id === charId) ?? characters[0];
  const ownerClass = CLASS_BY_ID[classId as ClassId] ?? (owner && classById(owner.classId));
  const specs = owner ? specsFor(owner) : [];

  // The toggle button always reflects the server-confirmed selection, never
  // the in-progress picks below — those aren't saved until pickSpec fires.
  const confirmedCharacter = current?.character ?? characters[0];
  const confirmedSpecId = current?.specId ?? (characters[0] ? bestSpecFor(characters[0]) : "");

  function pickClass(id: string) {
    setClassId(id);
    const next = characters.find((c) => c.classId === id);
    if (next) { setCharId(next.id); setSpecId(""); }
  }
  function pickChar(c: RosterCharacterDTO) {
    setCharId(c.id);
    setSpecId("");
  }
  async function pickSpec(id: string) {
    setSpecId(id);
    if (!owner) return;
    setSaving(true);
    try {
      await fetch("/api/characters/current", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId: owner.id, specId: id }),
      });
      router.refresh();
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  // Re-sync the in-progress picker to the confirmed selection each time it
  // opens, so a previous abandoned (unsaved) class/char switch doesn't linger.
  function toggleOpen() {
    setOpen((v) => {
      if (!v) {
        setClassId(confirmedCharacter?.classId ?? "");
        setCharId(confirmedCharacter?.id ?? "");
        setSpecId(current?.specId ?? "");
      }
      return !v;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="relative chip bg-panel2 border border-panelborder text-gray-200 hover:border-accent/50 flex items-center gap-1.5"
      >
        {hasCharacters ? (
          <>
            <SpecIcon specId={confirmedSpecId} size={20} showRole={false} />
            <span>{confirmedCharacter?.name}</span>
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-[#00aeff]" />
            <span>{displayName}</span>
          </>
        )}
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Network" />
        {pendingCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] panel p-3 shadow-card">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 pb-3 border-b border-panelborder">
            {season.expansion} · S{season.season}
          </div>

          {hasCharacters && (
            <div className="space-y-3 pt-3 pb-3 border-b border-panelborder">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Current character</div>

              <div className="flex flex-wrap gap-1.5">
                {classIds.map((id) => {
                  const cls = CLASS_BY_ID[id as ClassId];
                  return (
                    <button
                      key={id} onClick={() => pickClass(id)}
                      title={cls?.name}
                      className={cn("rounded-md border p-1", classId === id ? "border-gold bg-panel2" : "border-panelborder hover:bg-panel2")}
                    >
                      <WowIcon slug={classIconSlug(id)} size={28} fallbackColor={cls?.color} fallbackGlyph={cls?.glyph} />
                    </button>
                  );
                })}
              </div>

              {charsOfClass.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {charsOfClass.map((c) => (
                    <button
                      key={c.id} onClick={() => pickChar(c)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        charId === c.id ? "border-gold bg-panel2 text-white" : "border-panelborder text-gray-400 hover:bg-panel2"
                      )}
                    >
                      {c.name}
                      {duplicateNames.has(c.name) && <span className="text-gray-500"> · {c.realm}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {specs.map((sp) => (
                  <button
                    key={sp.id} onClick={() => pickSpec(sp.id)}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border pr-2 pl-1 py-1",
                      specId === sp.id ? "border-gold bg-panel2" : "border-panelborder hover:bg-panel2"
                    )}
                  >
                    <SpecIcon specId={sp.id} size={24} showRole={false} />
                    <span className="text-xs" style={{ color: ownerClass?.color }}>{sp.name}</span>
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-gray-500">Used to list keys and apply to groups.</p>
            </div>
          )}

          <div className="py-3 border-b border-panelborder">
            <Link
              href="/network"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md border border-panelborder bg-panel2/40 px-2.5 py-2 hover:border-accent/50 hover:bg-panel2 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-sm text-gray-200">Network</span>
              <span className="ml-auto text-xs text-gray-500 tabular-nums">{onlineCount} online</span>
              {pendingCount > 0 && (
                <span className="chip bg-amber-500/20 text-amber-300 px-1.5 py-0">{pendingCount}</span>
              )}
              <ChevronRightIcon />
            </Link>
          </div>

          <div className="pt-3 space-y-2">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md border border-panelborder bg-panel2/40 px-2.5 py-2 hover:border-accent/50 hover:bg-panel2 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#00aeff] shrink-0" />
              <span className="text-sm text-gray-200 truncate">{battletag ?? displayName}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-500 shrink-0">Profile</span>
              <ChevronRightIcon />
            </Link>
            <form action={onLogout}>
              <button className="w-full text-left rounded-md px-2 py-1.5 -mx-2 text-xs uppercase tracking-wide text-gray-500 hover:text-white hover:bg-panel2">
                Logout
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
