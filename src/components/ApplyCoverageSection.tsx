"use client";

import { useState } from "react";
import type { CoverageItem } from "@/game/coverage";
import { WowIcon } from "./WowIcon";
import { cn } from "@/lib/utils";

function chipTitle(it: CoverageItem): string {
  const base = it.description ?? it.label;
  return it.requiresTalent ? `${base} — requires this player to have the talent selected; not guaranteed just by spec.` : base;
}

/** Collapsed-by-default, HAVE-only variant of CoverageSection for the Apply
 * modal — an applicant only needs to show off what they bring, not the full
 * Have/Want/Missing planning breakdown. 3-per-row keeps each chip compact. */
export function ApplyCoverageSection({
  label, have,
}: {
  label: string;
  have: CoverageItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-2 border-t border-panelborder/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        {have.length > 0 && <span className="text-[10px] text-emerald-400">{have.length}</span>}
        <span className="ml-auto text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        have.length === 0 ? (
          <p className="text-xs text-gray-700 pt-2">None</p>
        ) : (
          <div className="grid grid-cols-3 gap-1 pt-2">
            {have.map((it) => (
              <span
                key={it.id}
                className="chip border text-[10px] bg-emerald-500/10 border-emerald-500/40 text-emerald-200 justify-start"
                title={chipTitle(it)}
              >
                <WowIcon slug={it.iconSlug} size={13} cdnSize="small" rounded="sm" fallbackColor={it.fallbackColor} />
                <span className="truncate">{it.label}</span>
                {it.requiresTalent && <span className="text-amber-300 shrink-0" title="Requires talent">⚠</span>}
              </span>
            ))}
          </div>
        )
      )}
    </div>
  );
}
