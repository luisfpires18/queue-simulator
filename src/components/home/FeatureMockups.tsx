// Small real-UI mockups for the home page's alternating feature sections —
// built from the app's actual icon components/tokens, not screenshots (none
// exist in public/, and these stay visually in sync with the real app for
// free). None of these need "use client" themselves — WowIcon.tsx already
// carries that boundary where it's actually needed.
import { WowIcon } from "@/components/WowIcon";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import { MISC_ICON, SPELL_ICON, classIconSlug } from "@/game/icons";
import { BUFF_BY_ID } from "@/game/buffs";
import { RAID_BY_ID } from "@/game/raidSeason";
import { CLASS_BY_ID, type ClassId, type Role } from "@/game/classes";
import { fmtK, pctColor } from "@/game/wclFormat";
import { cn } from "@/lib/utils";

// Same three states CoverageSection.tsx paints on the real board: a missing
// non-critical buff greys out rather than going red, so it reads as "nobody
// here brings this" instead of "this group is broken".
function Chip({ label, status, icon }: { label: string; status: "have" | "want" | "missing"; icon?: string }) {
  const cls =
    status === "have"
      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
      : status === "want"
      ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
      : "bg-panel2 border-panelborder text-gray-500";
  return (
    <span className={cn("chip border", cls)}>
      {icon && (
        <WowIcon
          slug={icon}
          size={12}
          cdnSize="small"
          rounded="sm"
          className={status === "missing" ? "grayscale opacity-70" : undefined}
        />
      )}
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
    <div className="flex flex-col items-center gap-1 w-14">
      <SpecIcon specId={specId} size={40} />
      <span className="text-[9px] text-gray-300 text-center leading-tight">{name}</span>
    </div>
  );
}

// An open, wanted slot - dashed role-colored border, same as a real open
// slot on the board, with the specifically-wanted spec shown dimmed inside.
function MockOpenSlot({ role, specId, name }: { role: Role; specId?: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-14">
      <div className={cn("w-10 h-10 rounded-md border border-dashed grid place-items-center bg-panel2/40", ROLE_BORDER[role])}>
        {specId ? <SpecIcon specId={specId} size={34} dim /> : <RoleIcon role={role} size={20} rounded="sm" className="grayscale opacity-60" />}
      </div>
      <span className="text-[9px] text-gray-500 text-center leading-tight">{name}</span>
    </div>
  );
}

// Buffs the mocked comp covers, keyed off BUFFS so the labels and icons stay
// correct if a buff is renamed or reworked in a patch.
const KEY_BOARD_BUFFS: { id: string; status: "have" | "missing" }[] = [
  { id: "battleshout", status: "have" },
  { id: "mystictouch", status: "have" },
  { id: "motw", status: "have" },
  { id: "skyfury", status: "have" },
  { id: "atrophicpoison", status: "missing" },
];

export function KeyBoardMockup() {
  return (
    <div className="space-y-3 w-full max-w-xs">
      <div className="flex items-center gap-2">
        <WowIcon slug={MISC_ICON.keystone} size={24} cdnSize="medium" rounded="sm" />
        <span className="text-accent font-black text-lg tabular-nums">+20</span>
        <span className="font-bold text-sm">Pit of Saron</span>
      </div>
      <div className="flex gap-1.5">
        <MockFilledSlot specId="monk:brewmaster" name="Brewmaster Monk" />
        <MockFilledSlot specId="shaman:restoration" name="Restoration Shaman" />
        <MockFilledSlot specId="druid:feral" name="Feral Druid" />
        <MockFilledSlot specId="warrior:arms" name="Arms Warrior" />
        <MockOpenSlot role="DPS" specId="rogue:outlaw" name="Outlaw Rogue" />
      </div>
      {/* The four filled slots each carry one buff; Atrophic Poison greys out
          because it rides on the rogue slot that is still open. */}
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Bloodlust" status="have" icon={SPELL_ICON.lust} />
        <Chip label="Battle Res" status="have" icon={SPELL_ICON.combatRes} />
        {KEY_BOARD_BUFFS.map(({ id, status }) => (
          <Chip key={id} label={BUFF_BY_ID[id].short} status={status} icon={BUFF_BY_ID[id].icon} />
        ))}
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

// Same card language as CharacterCard.tsx (class icon, name in class color,
// rating, gold star on the main), condensed to a row so four fit the panel.
const ROSTER_MOCK = [
  { name: "Aeliana", classId: "priest" as ClassId, rating: 2841, isMain: true },
  { name: "Aeliablade", classId: "warrior" as ClassId, rating: 2390, isMain: false },
  { name: "Aelimage", classId: "mage" as ClassId, rating: 2114, isMain: false },
  { name: "Aelifang", classId: "druid" as ClassId, rating: 1876, isMain: false },
];

export function RosterMockup() {
  return (
    <div className="space-y-1.5 w-full max-w-xs">
      {ROSTER_MOCK.map((c) => {
        const cls = CLASS_BY_ID[c.classId];
        return (
          <div key={c.name} className="flex items-center gap-2 rounded-md border border-panelborder bg-panel2/40 px-2 py-1.5">
            <WowIcon slug={classIconSlug(c.classId)} size={24} fallbackColor={cls?.color} rounded="sm" />
            <span className="text-xs font-bold flex-1 truncate" style={{ color: cls?.color }}>{c.name}</span>
            {c.isMain && <span className="text-gold text-sm leading-none">★</span>}
            <span className="text-xs font-semibold text-gray-300 tabular-nums">{c.rating.toLocaleString("en-US")}</span>
          </div>
        );
      })}
    </div>
  );
}

// Same percentile bar language as DungeonOverview.tsx's rows, so the gap
// between you and the top parse is a visible bar, not just two numbers.
function MockDpsBar({ label, dps, pct }: { label: string; dps: number; pct: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="tabular-nums">
          <b>{fmtK(dps)}</b> dps <b style={{ color: pctColor(pct) }}>{pct}%</b>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-panel2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pctColor(pct) }} />
      </div>
    </div>
  );
}

export function CoachingMockup() {
  const you = { dps: 154962, pct: 62 };
  const top = { dps: 189431, pct: 99 };
  return (
    <div className="space-y-2.5 w-full max-w-xs">
      <MockDpsBar label="You" dps={you.dps} pct={you.pct} />
      <MockDpsBar label="Top of spec" dps={top.dps} pct={top.pct} />
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

// Same three-field layout as the real PlayerSearchBar, so this reads as a
// search box rather than a floating character.
export function SearchMockup() {
  return (
    <div className="w-full max-w-xs space-y-2">
      <div className="flex gap-1.5">
        <div className="bg-panel2 border border-panelborder rounded-md px-2.5 py-1.5 text-xs text-gray-400 shrink-0">EU</div>
        <div className="flex-1 bg-panel2 border border-panelborder rounded-md px-2.5 py-1.5 text-xs text-gray-500 truncate">Any realm</div>
      </div>
      <div className="flex gap-1.5">
        <div className="flex-1 bg-panel2 border border-panelborder rounded-md px-2.5 py-1.5 text-xs text-gray-500">Character name</div>
        <div className="btn-gold px-3 py-1.5 text-xs shrink-0">Search</div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <SpecIcon specId="priest:holy" size={28} />
        <div className="text-[11px] text-gray-500">Registered or not, every region and realm</div>
      </div>
    </div>
  );
}
