"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { WowIcon } from "@/components/WowIcon";
import { MISC_ICON } from "@/game/icons";
import type { SeasonDef } from "@/game/season";
import { cn } from "@/lib/utils";

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 16 16" fill="none" className={cn("w-3.5 h-3.5 shrink-0 transition-transform", open && "rotate-180")}>
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Top-right season switch for /profile - drives which season ProfileClient
 * shows via a `?season=` URL param (shared client state between this and
 * ProfileClient without prop-drilling through the server page, since they're
 * siblings under it). Picking the current season clears the param entirely,
 * so the plain /profile URL always means "live". Same custom-dropdown idiom
 * as AccountMenuClient's account menu, not a native <select>. */
export function SeasonSelector({ seasons, currentSeasonId }: { seasons: SeasonDef[]; currentSeasonId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("season") ?? currentSeasonId;
  const selected = seasons.find((s) => s.id === selectedId) ?? seasons[0];

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(seasonId: string) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (seasonId === currentSeasonId) params.delete("season");
    else params.set("season", seasonId);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="chip bg-panel2 border border-panelborder text-gray-200 hover:border-accent/50 flex items-center gap-1.5"
      >
        <WowIcon slug={MISC_ICON.keystone} size={20} cdnSize="small" rounded="sm" />
        <span className="font-semibold">
          {selected.expansion} · S{selected.season}
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-30 w-64 max-w-[calc(100vw-2rem)] panel p-1.5 shadow-card">
          {seasons.map((s) => {
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md p-2 text-left transition-colors",
                  active ? "bg-accent/10" : "hover:bg-panel2"
                )}
              >
                <WowIcon
                  slug={MISC_ICON.keystone}
                  size={28}
                  cdnSize="small"
                  rounded="sm"
                  className={s.id === currentSeasonId ? undefined : "grayscale opacity-60"}
                />
                <span className="min-w-0">
                  <span className={cn("block text-sm font-bold truncate", active ? "text-accent" : "text-gray-200")}>
                    {s.expansion} · Season {s.season}
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    Patch {s.patch}
                    {s.id === currentSeasonId && " · Current"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
