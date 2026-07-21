"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Real links rather than the Tabs primitive: each admin section is its own
// route, so they must be navigable, bookmarkable and server-rendered. Tabs
// switches client state, which is the wrong tool here.
const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/features", label: "Features" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/ops", label: "Ops" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex items-center gap-1 overflow-x-auto border-b border-panelborder [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SECTIONS.map((s) => {
        // Exact match for Overview, prefix for the rest - otherwise "/admin"
        // would light up on every child route.
        const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 -mb-px px-3 py-2.5 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t",
              active ? "border-accent text-white" : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
