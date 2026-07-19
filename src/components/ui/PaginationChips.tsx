"use client";

import { cn } from "@/lib/utils";

/** The Prev / "Page x of y" / Next chip row shared by both boards and the
 * pending-requests modal. */
export function PaginationChips({
  page, totalPages, onPrev, onNext, className,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className={cn("chip border border-panelborder text-gray-400", page <= 1 ? "opacity-40" : "hover:bg-panel2")}
      >
        ← Prev
      </button>
      <span className="text-[11px] text-gray-500">Page {page} / {totalPages}</span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className={cn("chip border border-panelborder text-gray-400", page >= totalPages ? "opacity-40" : "hover:bg-panel2")}
      >
        Next →
      </button>
    </div>
  );
}
