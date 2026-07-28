"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, languageByCode } from "@/game/languages";
import { cn } from "@/lib/utils";

/** Searchable language dropdown - the same custom listbox as CountrySelect
 * (type to filter an already-alphabetical list, faster than native
 * type-to-jump), minus the flag icons: a language doesn't map to one flag. */
export function LanguageSelect({
  value, onChange,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = value ? languageByCode(value) : null;

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
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => l.name.toLowerCase().includes(q));
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
        {selected ? <span className="truncate">{selected.name}</span> : <span className="text-gray-500">— Not set —</span>}
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
              className="w-full px-3 py-1.5 text-sm text-left text-gray-500 hover:bg-panel2"
            >
              — Not set —
            </button>
            {filtered.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => pick(l.code)}
                className={cn(
                  "w-full px-3 py-1.5 text-sm text-left hover:bg-panel2",
                  l.code === value && "bg-accent/10 text-accent"
                )}
              >
                {l.name}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-600">No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
