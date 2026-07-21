"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  /** Rendered as a small pill after the label. Omit rather than passing 0 -
   * "Applications 0" reads worse than plain "Applications". */
  count?: number;
  disabled?: boolean;
}

/** Horizontal tab bar following the WAI-ARIA tabs pattern: arrow keys move
 * between tabs, Home/End jump to the ends, and only the active tab is in the
 * page tab order (roving tabindex) so Tab moves past the bar rather than
 * through every tab in it.
 *
 * Scrolls horizontally on narrow screens instead of wrapping, which keeps the
 * bar one row tall on mobile. */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent) {
    const enabled = tabs.filter((t) => !t.disabled);
    const i = enabled.findIndex((t) => t.id === active);
    if (i < 0) return;

    let next: string | undefined;
    if (e.key === "ArrowRight") next = enabled[(i + 1) % enabled.length]?.id;
    else if (e.key === "ArrowLeft") next = enabled[(i - 1 + enabled.length) % enabled.length]?.id;
    else if (e.key === "Home") next = enabled[0]?.id;
    else if (e.key === "End") next = enabled[enabled.length - 1]?.id;
    if (!next) return;

    e.preventDefault();
    onChange(next);
    // Move focus with the selection so the keyboard user sees where they are.
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-center gap-1 overflow-x-auto border-b border-panelborder",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => !t.disabled && onChange(t.id)}
            className={cn(
              "shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors",
              "border-b-2 -mb-px focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t",
              selected
                ? "border-accent text-white"
                : "border-transparent text-gray-400 hover:text-gray-200",
              t.disabled && "opacity-40 cursor-not-allowed hover:text-gray-400"
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 rounded bg-panel2 px-1.5 py-0.5 text-[11px] text-gray-300">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pairs with a Tabs entry of the same id so screen readers connect the two. */
export function TabPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: string;
  children: React.ReactNode;
}) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className="focus:outline-none">
      {children}
    </div>
  );
}
