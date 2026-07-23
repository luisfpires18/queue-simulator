"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrentSelectionDTO, RosterCharacterDTO } from "@/data/dto";
import { CLASS_BY_ID, specById, classById, type ClassId } from "@/game/classes";
import { bestSpecFor } from "@/game/roster";
import { classIconSlug } from "@/game/icons";
import { WowIcon } from "./WowIcon";
import { SpecIcon } from "./SpecIcon";
import { cn } from "@/lib/utils";

/** A character's selectable specs, highest score first (main spec pinned
 * first among ties/no-score specs): its curated tracked list once one
 * exists, else every spec of its class (pre-curation fallback, same as the
 * old per-form pickers this replaces). */
function specsFor(character: RosterCharacterDTO) {
  if (character.specTracks.length > 0) {
    return [...character.specTracks]
      .sort((a, b) => {
        const mainDiff = (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0);
        if (mainDiff !== 0) return mainDiff;
        return (b.bnetScore ?? b.points ?? -1) - (a.bnetScore ?? a.points ?? -1);
      })
      .map((t) => specById(t.specId))
      .filter((sp): sp is NonNullable<typeof sp> => sp != null);
  }
  return classById(character.classId)?.specs ?? [];
}

export function CurrentCharacterPicker({
  characters, current,
}: {
  characters: RosterCharacterDTO[];
  current: CurrentSelectionDTO | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(current?.character.classId ?? characters[0]?.classId ?? "");
  const [charId, setCharId] = useState(current?.character.id ?? characters[0]?.id ?? "");
  const [specId, setSpecId] = useState(current?.specId ?? (characters[0] ? bestSpecFor(characters[0]) : ""));
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
  // "Unreally" buttons side by side are indistinguishable (confirmed live:
  // this account has one on each of two realms).
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of characters) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    return new Set([...counts].filter(([, n]) => n > 1).map(([name]) => name));
  }, [characters]);

  const charsOfClass = characters.filter((c) => c.classId === classId);
  const owner = characters.find((c) => c.id === charId) ?? characters[0];
  const ownerClass = CLASS_BY_ID[classId as ClassId] ?? (owner && classById(owner.classId));
  const specs = owner ? specsFor(owner) : [];

  // The toggle button always reflects the server-confirmed selection, never
  // the in-progress picks below — those aren't saved until pickSpec fires.
  const confirmedCharacter = current?.character ?? characters[0];
  const confirmedSpecId = current?.specId ?? (characters[0] ? bestSpecFor(characters[0]) : "");

  // Switching class/character only stages a choice — nothing is saved until
  // pickSpec fires, so leave no spec highlighted here (a pre-highlighted spec
  // looks already-selected even though the server still has the old one).
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

  if (characters.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="chip bg-panel2 border border-panelborder text-gray-200 hover:border-accent/50 flex items-center gap-1.5"
      >
        <SpecIcon specId={confirmedSpecId} size={20} showRole={false} />
        {/* Always visible - this is the only place this component ever
            renders below the sm: breakpoint (inside MobileNavDrawer, which
            only shows there), so a name hidden below sm: meant it never
            showed on mobile at all, just a bare icon. */}
        <span>{confirmedCharacter?.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] panel p-3 shadow-card space-y-3">
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
    </div>
  );
}
