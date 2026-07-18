import type { Analysis } from "@/game/analyze";
import { cn } from "@/lib/utils";
import { WowIcon } from "./WowIcon";
import { SPELL_ICON } from "@/game/icons";

function Badge({
  ok,
  icon,
  iconSlug,
  label,
  tip,
  neutral,
}: {
  ok: boolean;
  icon?: string;
  iconSlug?: string;
  label: string;
  tip?: string;
  neutral?: boolean;
}) {
  return (
    <span
      title={tip}
      className={cn(
        "chip border",
        neutral
          ? "bg-panel2 border-panelborder text-gray-300"
          : ok
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
          : "bg-rose-500/10 border-rose-500/40 text-rose-300"
      )}
    >
      {iconSlug ? <WowIcon slug={iconSlug} size={14} rounded="sm" fallbackGlyph={icon} /> : icon}
      {label}
    </span>
  );
}

const ARCH_STYLE: Record<string, string> = {
  meta: "bg-tier-legend/15 border-tier-legend/50 text-tier-legend",
  physical: "bg-orange-500/15 border-orange-500/50 text-orange-300",
  offmeta: "bg-panel2 border-panelborder text-gray-400",
};

export function AnalyzerBadges({ a }: { a: Analysis }) {
  const lustTip = a.lust
    ? "Bloodlust: " + a.utilities[0].providers.map((p) => p.ability).join(", ")
    : "No Bloodlust in group";
  const resTip = a.combatRes
    ? "Battle Res: " + a.utilities[1].providers.map((p) => p.ability).join(", ")
    : "No Combat Res in group";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("chip border font-semibold", ARCH_STYLE[a.archetype.id] ?? ARCH_STYLE.offmeta)} title={a.archetype.blurb}>
        {a.archetype.id === "meta" ? "⚑" : a.archetype.id === "physical" ? "🪓" : "◇"} {a.archetype.label}
        {a.archetype.confidence > 0 && a.archetype.id !== "offmeta" && (
          <span className="opacity-70">· {a.archetype.confidence}%</span>
        )}
      </span>
      <Badge ok={a.lust} icon="🩸" iconSlug={SPELL_ICON.lust} label="Lust" tip={lustTip} />
      <Badge ok={a.combatRes} icon="💀" iconSlug={SPELL_ICON.combatRes} label="Res" tip={resTip} />
      <Badge ok={a.rolesOk} neutral={!a.rolesOk && a.size < 5} icon="👥" label={`${a.roles.tank}/${a.roles.healer}/${a.roles.dps}`} tip="Tank / Healer / DPS" />
    </div>
  );
}

export function NeedsList({ a }: { a: Analysis }) {
  if (!a.needs.length) {
    return <p className="text-sm text-emerald-400 font-semibold">✓ Group is complete - Lust, Battle Res, and full roles covered.</p>;
  }
  return (
    <ul className="space-y-1">
      {a.needs.map((n, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span className={n.severity === "critical" ? "text-rose-400" : "text-amber-400"}>
            {n.severity === "critical" ? "✗" : "○"}
          </span>
          <span className="text-gray-200">{n.text}</span>
        </li>
      ))}
    </ul>
  );
}
