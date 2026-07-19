"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** Shared overlay shell: dimmed backdrop (click closes), Escape closes, and
 * click-inside stops propagation. The caller renders its own panel content -
 * header rows, close buttons, etc. stay per-modal, only the overlay
 * mechanics live here. Modals that deliberately DON'T close on Escape (e.g.
 * PendingRequestsModal) keep their own markup. */
export function Modal({
  open, onClose, panelClassName, overlayClassName, children,
}: {
  open: boolean;
  onClose: () => void;
  /** Classes for the inner panel (width, padding, scroll behavior). */
  panelClassName: string;
  /** Extra overlay classes - e.g. a higher z-index for error modals that
   * must sit above another open modal. */
  overlayClassName?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn("fixed inset-0 z-50 grid place-items-center bg-black/70 p-4", overlayClassName)}
      onClick={onClose}
    >
      <div className={panelClassName} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
