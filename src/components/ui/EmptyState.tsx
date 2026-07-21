import { cn } from "@/lib/utils";

/** Shown when a list has nothing in it. Every recruitment surface has an empty
 * state that says what to do next rather than just "No results" - an empty
 * board is the normal first experience here, not an error. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel px-6 py-12 text-center", className)}>
      <p className="text-sm font-semibold text-gray-300">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
