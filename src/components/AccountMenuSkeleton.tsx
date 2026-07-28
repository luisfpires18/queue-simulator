/** Suspense fallback for AccountMenu (see src/app/layout.tsx) - sized to
 * match the real chip's footprint (icon + name) so streaming it in doesn't
 * shift layout. */
export function AccountMenuSkeleton() {
  return (
    <div className="chip bg-panel2 border border-panelborder gap-1.5" aria-hidden>
      <span className="h-5 w-5 rounded-full bg-panelborder animate-pulse" />
      <span className="h-3 w-14 rounded bg-panelborder animate-pulse" />
    </div>
  );
}
