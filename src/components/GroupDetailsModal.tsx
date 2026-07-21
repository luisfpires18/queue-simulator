"use client";

import type { GroupDTO } from "@/data/dto";
import { DUNGEON_BY_ID } from "@/game/season";
import { RAID_BY_ID, RAID_DIFFICULTY_LABEL, type RaidDifficulty } from "@/game/raidSeason";
import { MISC_ICON } from "@/game/icons";
import {
  computeBuffCoverage, computeUtilityCoverage, computeDefensiveCoverage, computeExternalDefensiveCoverage,
  computeDispelCoverage, computeEnemyDispelCoverage, computeSkipCoverage,
} from "@/game/coverage";
import { specById, CLASS_BY_ID, type Role } from "@/game/classes";
import { requirementChipLabel, startInfo } from "@/lib/format";
import { RoleIcon } from "./RoleIcon";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { CountdownLight } from "./CountdownLight";
import { Modal } from "./ui/Modal";
import { ROLE_LABEL, CoveragePanel, UtilityCoveragePanel } from "./GroupFormShared";
import { cn } from "@/lib/utils";

function isUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Everything a compact GroupCard leaves out or truncates: full description,
 * every accepted spec per open slot (not just a hover popover), and - for M+
 * keys - the comp analysis (Bloodlust/Battle Res coverage, archetype match,
 * needs) that src/game/analyze.ts computes but nothing in the UI surfaced
 * before this. Opened by the "Details" button on GroupCard. */
export function GroupDetailsModal({
  group, open, onClose, viewerUserId,
}: {
  group: GroupDTO;
  open: boolean;
  onClose: () => void;
  /** Gates the route box below - only a confirmed member (owner or an
   * accepted applicant) can see it, not every board visitor. */
  viewerUserId?: string | null;
}) {
  // Bail before the coverage computations below - this modal is mounted
  // (closed) on every GroupCard, and closed cards shouldn't pay for them.
  if (!open) return null;

  const isRaid = group.kind === "raid";
  const dungeon = group.dungeonId ? DUNGEON_BY_ID[group.dungeonId] : undefined;
  const raid = group.raidId ? RAID_BY_ID[group.raidId] : undefined;
  const requirementLabel = requirementChipLabel(group);
  const owner = group.members.find((m) => m.slot === 0);
  const start = startInfo(group.startsAt);
  const isConfirmedMember = viewerUserId != null && group.members.some((m) => m.userId === viewerUserId);

  // Same HAVE (filled members' specs) vs. WANT (open-slot prefs + desired
  // combos) shape ListKeyForm/RaidListForm use while building a listing -
  // here it's read-only, showing what this key already covers.
  const haveSpecIds = group.members.map((m) => m.broughtSpecId ?? m.specId);
  const desiredSpecIds = [
    ...group.slots.flatMap((s) => s.prefs),
    ...group.combos.flatMap((c) => c.map((m) => m.specId)),
  ];
  const buffCoverage = computeBuffCoverage(haveSpecIds, desiredSpecIds);
  const utilityCoverage = computeUtilityCoverage(haveSpecIds, desiredSpecIds);
  const defensiveCoverage = computeDefensiveCoverage(haveSpecIds, desiredSpecIds);
  const externalDefensiveCoverage = computeExternalDefensiveCoverage(haveSpecIds, desiredSpecIds);
  const dispelCoverage = computeDispelCoverage(haveSpecIds, desiredSpecIds);
  const enemyDispelCoverage = computeEnemyDispelCoverage(haveSpecIds, desiredSpecIds);
  const skipCoverage = computeSkipCoverage(haveSpecIds, desiredSpecIds);
  const isKey = group.kind !== "raid"; // skips are a Mythic+ thing

  return (
    <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Key details</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* header */}
        <div>
          <div className="flex items-center gap-2">
            {isRaid ? (
              <>
                {raid?.icon && <WowIcon slug={raid.icon} size={28} cdnSize="medium" rounded="sm" />}
                <span className="text-accent font-black text-xs uppercase tracking-wide">
                  {group.raidDifficulty ? RAID_DIFFICULTY_LABEL[group.raidDifficulty as RaidDifficulty] : ""}
                </span>
                <span className="font-bold">{raid?.name ?? group.raidId}</span>
                <span className="text-[11px] text-gray-500 tabular-nums ml-auto">
                  {group.members.length}/{group.raidSize}
                </span>
              </>
            ) : (
              <>
                <WowIcon slug={MISC_ICON.keystone} size={28} cdnSize="medium" rounded="sm" />
                <span className="text-accent font-black text-xl tabular-nums">+{group.keyLevel}</span>
                <span className="font-bold">{dungeon?.name ?? group.dungeonId}</span>
              </>
            )}
          </div>
          <div className="text-sm text-gray-300 mt-1">{group.title}</div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={cn(
                "chip border font-bold",
                start.urgent
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-500/50 bg-amber-500/15 text-amber-300"
              )}
            >
              {start.urgent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />}
              {start.label}
            </span>
            <CountdownLight startsAt={group.startsAt} />
            {owner && (
              <span className="text-[11px] text-gray-500">
                Led by <span className="text-gray-300 font-semibold">{owner.name}</span>
              </span>
            )}
            {requirementLabel && (
              <span className="chip border border-panelborder text-gray-400" title="Applicant requirement (advisory only)">
                {requirementLabel}
              </span>
            )}
          </div>
        </div>

        {group.description && <p className="text-sm text-gray-300">{group.description}</p>}

        {!isRaid && group.route && isConfirmedMember && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-sky-300">🗺️ Route (Mythic Dungeon Tools)</div>
              <button
                onClick={() => navigator.clipboard.writeText(group.route!)}
                className="text-[10px] text-gray-500 hover:text-gray-200"
                title="Copy route"
              >
                📋 Copy
              </button>
            </div>
            {isUrl(group.route) ? (
              <a
                href={group.route}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline break-all"
              >
                {group.route}
              </a>
            ) : (
              <p className="text-xs text-gray-300 font-mono break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                {group.route}
              </p>
            )}
          </div>
        )}

        {/* full roster: filled + open, every accepted spec listed out */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Roster</div>
          {group.members.map((m) => {
            const cls = CLASS_BY_ID[m.classId as keyof typeof CLASS_BY_ID];
            return (
              <div key={m.id} className="flex items-center gap-2">
                <RoleIcon role={m.role as Role} size={16} rounded="sm" />
                <SpecIcon specId={m.broughtSpecId ?? m.specId ?? `${m.classId}:unknown`} size={24} showRole={false} />
                <span className="text-sm font-semibold" style={{ color: cls?.color }}>{m.name}</span>
                <span className="text-[11px] text-gray-500">{m.realm}</span>
              </div>
            );
          })}
          {group.slots.map((s, i) => {
            const prefs = s.prefs.length > 0 ? s.prefs : null;
            return (
              <div key={i} className="flex items-start gap-2">
                <RoleIcon role={s.role as Role} size={16} rounded="sm" className="mt-0.5 grayscale opacity-60" />
                <div className="min-w-0">
                  <span className="text-sm text-gray-400">Open - {ROLE_LABEL[s.role as Role] ?? s.role}</span>
                  {prefs && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {prefs.map((id) => {
                        const sp = specById(id);
                        const c = sp ? CLASS_BY_ID[sp.classId] : null;
                        return (
                          <span key={id} className="flex items-center gap-1 chip border border-panelborder">
                            <SpecIcon specId={id} size={16} showRole={false} />
                            <span className="text-[11px]" style={{ color: c?.color }}>{sp?.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* same buff/utility/dispel/defensive coverage shown while listing a
            key (ListKeyForm/RaidListForm) - here read-only, over the actual
            filled members vs. what the open slots/combos still want. */}
        <CoveragePanel title="Buffs & Debuffs" coverage={buffCoverage} />

        <UtilityCoveragePanel coverage={utilityCoverage} />

        <CoveragePanel title="Friendly Dispels" coverage={dispelCoverage} />
        <CoveragePanel title="Enemy Magic Dispels" coverage={enemyDispelCoverage} />
        <CoveragePanel title="Party Defensives" coverage={defensiveCoverage} />
        <CoveragePanel title="External Defensives" coverage={externalDefensiveCoverage} />
        {isKey && <CoveragePanel title="Skips" coverage={skipCoverage} />}

        {group.combos.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Desired comps</div>
            <div className="flex flex-wrap gap-2">
              {group.combos.map((combo, i) => (
                <div key={i} className="flex items-center gap-1 rounded-md border border-panelborder bg-panel2/40 px-1.5 py-1">
                  {combo.map((m, j) => (
                    <SpecIcon key={j} specId={m.specId} size={20} showRole={false} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
    </Modal>
  );
}
