"use client";

/**
 * One collapsible block of the improvement report. Lifted out of ReportView so
 * sections living in their own files (RotationReviewSection) render identically
 * to the ones still defined inline, instead of carrying a second copy of this
 * markup that drifts on the first style tweak.
 */
export function Section({
  title,
  sub,
  children,
  open = false,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="border-t border-panelborder/60 pt-3" open={open}>
      <summary className="cursor-pointer select-none text-sm font-bold mb-2">
        {title} {sub && <small className="text-gray-500 font-normal">{sub}</small>}
      </summary>
      {children}
    </details>
  );
}
