// Small real-UI mockups for the home page's alternating feature sections —
// built from the app's actual icon components/tokens, not screenshots (none
// exist in public/, and these stay visually in sync with the real app for
// free). None of these need "use client" themselves — WowIcon.tsx already
// carries that boundary where it's actually needed.
import { WowIcon } from "@/components/WowIcon";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import { MISC_ICON, SPELL_ICON } from "@/game/icons";
import { BUFF_BY_ID } from "@/game/buffs";
import { RAID_BY_ID } from "@/game/raidSeason";
import { CLASSES, type Role } from "@/game/classes";
import { fmtK, pctColor } from "@/game/wclFormat";
import { cn } from "@/lib/utils";

function Chip({ label, status, icon }: { label: string; status: "have" | "want" | "missing"; icon?: string }) {
  const cls =
    status === "have"
      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
      : status === "want"
      ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
      : "bg-rose-500/10 border-rose-500/40 text-rose-200";
  return (
    <span className={cn("chip border", cls)}>
      {icon && <WowIcon slug={icon} size={12} cdnSize="small" rounded="sm" />}
      {label}
    </span>
  );
}

const ROLE_BORDER: Record<Role, string> = {
  TANK: "border-sky-400/40",
  HEALER: "border-emerald-400/40",
  DPS: "border-rose-400/40",
};

// A filled roster slot - real spec icon + full spec/class name, same visual
// language as GroupCard.tsx's real slot squares.
function MockFilledSlot({ specId, name }: { specId: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <SpecIcon specId={specId} size={40} />
      <span className="text-[9px] text-gray-300 text-center leading-tight">{name}</span>
    </div>
  );
}

// An open, wanted slot - dashed role-colored border, same as a real open
// slot on the board, with the specifically-wanted spec shown dimmed inside.
function MockOpenSlot({ role, specId, name }: { role: Role; specId?: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className={cn("w-10 h-10 rounded-md border border-dashed grid place-items-center bg-panel2/40", ROLE_BORDER[role])}>
        {specId ? <SpecIcon specId={specId} size={34} dim /> : <RoleIcon role={role} size={20} rounded="sm" className="grayscale opacity-60" />}
      </div>
      <span className="text-[9px] text-gray-500 text-center leading-tight">{name}</span>
    </div>
  );
}

export function KeyBoardMockup() {
  return (
    <div className="space-y-3 w-full max-w-sm">
      <div className="flex items-center gap-2">
        <WowIcon slug={MISC_ICON.keystone} size={24} cdnSize="medium" rounded="sm" />
        <span className="text-accent font-black text-lg tabular-nums">+20</span>
        <span className="font-bold text-sm">Pit of Saron</span>
      </div>
      {/* five slots, one row */}
      <div className="grid grid-cols-5 gap-1 justify-items-center">
        <MockFilledSlot specId="monk:brewmaster" name="Brewmaster Monk" />
        <MockFilledSlot specId="shaman:restoration" name="Restoration Shaman" />
        <MockFilledSlot specId="druid:feral" name="Feral Druid" />
        <MockFilledSlot specId="warrior:arms" name="Arms Warrior" />
        <MockOpenSlot role="DPS" specId="rogue:outlaw" name="Outlaw Rogue" />
      </div>
      {/* the whole group's coverage, not just Lust + Res */}
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Bloodlust" status="have" icon={SPELL_ICON.lust} />
        <Chip label="Battle Res" status="have" icon={SPELL_ICON.combatRes} />
        <Chip label={BUFF_BY_ID.mystictouch.short} status="have" icon={BUFF_BY_ID.mystictouch.icon} />
        <Chip label={BUFF_BY_ID.battleshout.short} status="have" icon={BUFF_BY_ID.battleshout.icon} />
        <Chip label={BUFF_BY_ID.motw.short} status="have" icon={BUFF_BY_ID.motw.icon} />
        <Chip label={BUFF_BY_ID.skyfury.short} status="have" icon={BUFF_BY_ID.skyfury.icon} />
        {/* Atrophic Poison comes from the still-open Rogue slot, so it's "want", not "have" */}
        <Chip label={BUFF_BY_ID.atrophicpoison.short} status="want" icon={BUFF_BY_ID.atrophicpoison.icon} />
      </div>
    </div>
  );
}

export function SoloQueueMockup() {
  return (
    <div className="space-y-3 w-full max-w-xs">
      {/* your filters */}
      <div className="flex flex-wrap gap-1.5">
        <span className="chip border border-panelborder bg-panel2/60 text-gray-300">+18 to +20</span>
        <span className="chip border border-panelborder bg-panel2/60 text-gray-300">
          <RoleIcon role="DPS" size={12} rounded="sm" /> DPS
        </span>
        <span className="chip border border-panelborder bg-panel2/60 text-gray-300">4 dungeons</span>
      </div>
      {/* a proposed group you can take or pass on */}
      <div className="panel bg-panel2/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <WowIcon slug={MISC_ICON.keystone} size={18} cdnSize="small" rounded="sm" />
          <span className="text-accent font-bold text-sm tabular-nums">+19</span>
          <span className="text-sm">Skyreach · needs a DPS</span>
        </div>
        <div className="flex gap-1">
          <SpecIcon specId="paladin:protection" size={22} showRole={false} />
          <SpecIcon specId="priest:holy" size={22} showRole={false} />
          <SpecIcon specId="mage:frost" size={22} showRole={false} />
          <SpecIcon specId="hunter:marksmanship" size={22} showRole={false} />
        </div>
        <div className="flex gap-2 pt-0.5">
          <span className="chip bg-emerald-500/15 border border-emerald-500/40 text-emerald-200">Accept</span>
          <span className="chip border border-panelborder text-gray-400">Pass</span>
        </div>
      </div>
    </div>
  );
}

const RAID_FILLED_SAMPLE: { specId: string; name: string }[] = [
  { specId: "paladin:holy", name: "Holy Paladin" },
  { specId: "hunter:marksmanship", name: "Marksmanship Hunter" },
  { specId: "deathknight:frost", name: "Frost Death Knight" },
  { specId: "evoker:devastation", name: "Devastation Evoker" },
  { specId: "monk:windwalker", name: "Windwalker Monk" },
];

export function RaidBoardMockup() {
  const voidspire = RAID_BY_ID.voidspire;
  return (
    <div className="space-y-3 w-full max-w-sm">
      <div className="flex items-center gap-2">
        {voidspire.icon && <WowIcon slug={voidspire.icon} size={24} cdnSize="medium" rounded="sm" />}
        <span className="text-accent font-black text-xs uppercase tracking-wide">Mythic</span>
        <span className="font-bold text-sm">{voidspire.name}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {RAID_FILLED_SAMPLE.map((m) => (
          <MockFilledSlot key={m.specId} specId={m.specId} name={m.name} />
        ))}
        <MockOpenSlot role="TANK" name="Tank" />
        <MockOpenSlot role="HEALER" name="Healer" />
        <MockOpenSlot role="DPS" specId="demonhunter:devourer" name="Devourer DH" />
      </div>
    </div>
  );
}

const ROSTER_MOCK_CLASSES = ["warrior", "mage", "priest", "druid"] as const;
const ROSTER_MOCK_PLAYED = new Set(["warrior:arms", "mage:frost", "priest:holy", "druid:feral"]);

export function RosterMockup() {
  const classes = CLASSES.filter((c) => (ROSTER_MOCK_CLASSES as readonly string[]).includes(c.id));
  return (
    <div className="space-y-2 w-full max-w-xs">
      {classes.map((c) => (
        <div key={c.id} className="flex items-center gap-1.5">
          {c.specs.map((s) => (
            <SpecIcon key={s.id} specId={s.id} size={28} showRole={false} dim={!ROSTER_MOCK_PLAYED.has(s.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CoachingMockup() {
  const you = { dps: 154962, pct: 62 };
  const top = { dps: 189431, pct: 99 };
  return (
    <div className="space-y-2 w-full max-w-xs text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-400">You</span>
        <span className="tabular-nums">
          <b>{fmtK(you.dps)}</b> dps <b style={{ color: pctColor(you.pct) }}>{you.pct}%</b>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-400">Top of spec</span>
        <span className="tabular-nums">
          <b>{fmtK(top.dps)}</b> dps <b style={{ color: pctColor(top.pct) }}>{top.pct}%</b>
        </span>
      </div>
      <p className="text-[11px] text-gray-500 pt-1">Biggest gap: casts per minute, -8% behind</p>
    </div>
  );
}

export function NotificationsMockup() {
  return (
    <div className="flex items-center gap-3 panel bg-panel2/60 px-4 py-3">
      <WowIcon slug={MISC_ICON.bell} size={28} cdnSize="medium" rounded="sm" />
      <div>
        <div className="text-sm font-semibold">New +20 opened</div>
        <div className="text-[11px] text-gray-500">Matches your alert range</div>
      </div>
    </div>
  );
}

export function SearchMockup() {
  return (
    <div className="flex items-center gap-3">
      <SpecIcon specId="priest:holy" size={40} />
      <div>
        <div className="text-sm font-semibold">Any character</div>
        <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
          <WowIcon slug={SPELL_ICON.lust} size={14} cdnSize="small" rounded="sm" />
          all regions, all servers
        </div>
      </div>
    </div>
  );
}
