"use client";

import { cn } from "@/lib/utils";

/** A toggle chip for filter rails. A real <button> with aria-pressed rather
 * than a styled div, so it is reachable and announced correctly; the selected
 * state is carried by border AND background, never colour alone. */
export function FilterChip({
  label,
  selected,
  onClick,
  title,
  className,
}: {
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        selected
          ? "border-accent bg-accent/15 text-white"
          : "border-panelborder text-gray-400 hover:border-gray-600 hover:text-gray-200",
        className
      )}
    >
      {label}
    </button>
  );
}

/** A labelled row of filter controls. The label is a real <legend> inside a
 * <fieldset> so the grouping is announced. */
export function FilterGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

/** Styled native <select>. Native rather than a custom listbox: it is
 * keyboard- and screen-reader-correct for free, and on mobile it opens the
 * platform picker, which is the better experience anyway. */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  /** Shown as the empty option - usually "Any". */
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-sm text-gray-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Multi-select as a chip grid. Used for languages, days and roles, where the
 * options are few enough to show at once and seeing every selection matters
 * more than saving space. */
export function MultiSelect({
  label,
  values,
  onChange,
  options,
  className,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }
  return (
    <FilterGroup label={label} className={className}>
      {options.map((o) => (
        <FilterChip key={o.value} label={o.label} selected={values.includes(o.value)} onClick={() => toggle(o.value)} />
      ))}
    </FilterGroup>
  );
}

/** Text/number field matching the select styling. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-600">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";
