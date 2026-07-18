"use client";

import { useState, type ReactNode } from "react";
import type { CoverageItem, CoverageStatus } from "@/game/coverage";
import { WowIcon } from "./WowIcon";
import { cn } from "@/lib/utils";

const COL_TITLE: Record<CoverageStatus, string> = {
  have: "text-emerald-400",
  want: "text-amber-400",
  missing: "text-gray-500",
};

function chipClass(status: CoverageStatus, critical: boolean): string {
  if (status === "have") return "bg-emerald-500/10 border-emerald-500/40 text-emerald-200";
  if (status === "want") return "bg-amber-500/10 border-amber-500/40 text-amber-200";
  return critical ? "bg-rose-500/10 border-rose-500/40 text-rose-200" : "bg-panel2 border-panelborder text-gray-500";
}

function chipTitle(it: CoverageItem): string {
  const base = it.description ?? it.label;
  return it.requiresTalent ? `${base} — requires this player to have the talent selected; not guaranteed just by spec.` : base;
}

function CovCol({ title, items, status }: { title: string; items: CoverageItem[]; status: CoverageStatus }) {
  return (
    <div>
      <div className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1.5", COL_TITLE[status])}>{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-700">-</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((it) => (
            <span key={it.id} className={cn("chip border text-[10px]", chipClass(it.status, it.critical))} title={chipTitle(it)}>
              <WowIcon
                slug={it.iconSlug}
                size={13}
                cdnSize="small"
                rounded="sm"
                fallbackColor={it.fallbackColor}
                className={status === "missing" ? "grayscale opacity-70" : undefined}
              />
              {it.label}
              {it.requiresTalent && <span className="text-amber-300" title="Requires talent">⚠</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Have / Want / Missing breakdown, collapsible so a full item list doesn't
 * blow up card height. Each chip's native title is its full tooltip description. */
export function CoverageSection({
  label, coverage, defaultOpen = false, warning,
}: {
  label: string;
  coverage: { have: CoverageItem[]; want: CoverageItem[]; missing: CoverageItem[] };
  defaultOpen?: boolean;
  warning?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn(!defaultOpen && "pt-2 border-t border-panelborder/60")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        {warning}
        <span className="ml-auto text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="grid grid-cols-3 gap-2 pt-2">
          <CovCol title="Have" items={coverage.have} status="have" />
          <CovCol title="Want" items={coverage.want} status="want" />
          <CovCol title="Missing" items={coverage.missing} status="missing" />
        </div>
      )}
    </div>
  );
}
