import Link from "next/link";
import { cn } from "@/lib/utils";

export function ListKindTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-2 mb-5">
      <Link
        href="/list?kind=mplus"
        className={cn("chip border", active !== "raid" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
      >
        M+ Key
      </Link>
      <Link
        href="/list?kind=raid"
        className={cn("chip border", active === "raid" ? "border-accent text-accent" : "border-panelborder text-gray-400")}
      >
        Raid
      </Link>
    </div>
  );
}
