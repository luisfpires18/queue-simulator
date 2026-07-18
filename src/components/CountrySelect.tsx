"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryByCode, flagUrl } from "@/game/countries";
import { cn } from "@/lib/utils";

/** Searchable country dropdown with flag icons — a native <select> can't
 * render images inside its options (browsers ignore anything but text
 * there), so this is a custom listbox: a text input that both shows the
 * current selection and filters the (already alphabetical) list as you
 * type, faster than scrolling/native type-to-jump. */
export function CountrySelect({
  value, onChange,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = value ? countryByCode(value) : null;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const pick = (code: string | null) => {
    onChange(code);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative max-w-xs w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm text-left"
      >
        {selected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flagUrl(selected.code)} width={20} height={15} alt="" className="rounded-[2px] shrink-0" />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-gray-500">— Not set —</span>
        )}
        <span className="ml-auto text-gray-500 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-panel border border-panelborder rounded-md shadow-card overflow-hidden">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="w-full bg-panel2 border-b border-panelborder px-3 py-2 text-sm outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => pick(null)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-500 hover:bg-panel2"
            >
              — Not set —
            </button>
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c.code)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-panel2",
                  c.code === value && "bg-accent/10 text-accent"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flagUrl(c.code)} width={20} height={15} alt="" className="rounded-[2px] shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-600">No matches.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
