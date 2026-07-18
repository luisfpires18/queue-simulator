import Link from "next/link";
import { cn } from "@/lib/utils";

export function HomeSection({
  eyebrow, title, description, cta, reverse = false, visual,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cta?: { href: string; label: string };
  reverse?: boolean;
  visual: React.ReactNode;
}) {
  return (
    <section className={cn("grid grid-cols-1 md:grid-cols-2 gap-8 items-center", reverse && "md:[&>*:first-child]:order-2")}>
      <div className="space-y-3">
        <span className="text-[11px] uppercase tracking-widest text-accent font-bold">{eyebrow}</span>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h2>
        <p className="text-gray-400 max-w-md">{description}</p>
        {cta && (
          <Link href={cta.href} className="inline-block text-accent text-sm font-semibold hover:underline pt-1">
            {cta.label} →
          </Link>
        )}
      </div>
      <div className="panel p-6 flex items-center justify-center min-h-[180px]">{visual}</div>
    </section>
  );
}
