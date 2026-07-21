"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Right-side slide-over for recruitment detail. Same backdrop/Escape
 * mechanics as Modal, but anchored to the edge and full-height, because
 * recruitment detail is a long scrolling read rather than a centred dialog.
 *
 * On mobile it becomes a bottom sheet - a 400px-wide side panel on a 390px
 * screen is just a modal with extra steps. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  widthClassName = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Focus the panel so Escape and screen readers land in the right place,
    // and lock body scroll so the page behind doesn't move under the sheet.
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/70"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full bg-panel border-panelborder flex flex-col focus:outline-none",
          "max-h-[85vh] rounded-t-xl border-t",
          "sm:max-h-none sm:h-full sm:rounded-none sm:border-t-0 sm:border-l",
          widthClassName
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-panelborder px-5 py-3.5 shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="rounded p-1 text-gray-400 hover:bg-panel2 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
