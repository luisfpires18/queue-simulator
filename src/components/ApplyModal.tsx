"use client";

import { useEffect, useState } from "react";
import type { ApplicationDTO, CurrentSelectionDTO, GroupDTO } from "@/data/dto";
import { specById, type Role } from "@/game/classes";
import { DUNGEON_BY_ID } from "@/game/season";
import { RAID_BY_ID, RAID_DIFFICULTY_LABEL, type RaidDifficulty } from "@/game/raidSeason";
import {
  computeBuffCoverage, computeUtilityCoverage, computeDefensiveCoverage, computeExternalDefensiveCoverage,
  computeDispelCoverage, computeEnemyDispelCoverage,
} from "@/game/coverage";
import { MISC_ICON } from "@/game/icons";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { RoleIcon } from "./RoleIcon";
import { ApplyCoverageSection } from "./ApplyCoverageSection";
import { SpecIcon } from "./SpecIcon";
import { WowIcon } from "./WowIcon";
import { ROLE_LABEL } from "./GroupFormShared";
import { cn } from "@/lib/utils";

export function ApplyModal({
  group, current, open, onClose, onApplied,
}: {
  group: GroupDTO;
  current: CurrentSelectionDTO | null;
  open: boolean;
  onClose: () => void;
  onApplied?: (application: ApplicationDTO) => void;
}) {
  const isRaid = group.kind === "raid";
  const dungeon = group.dungeonId ? DUNGEON_BY_ID[group.dungeonId] : undefined;
  const raid = group.raidId ? RAID_BY_ID[group.raidId] : undefined;
  const [note, setNote] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [route, setRoute] = useState("");
  const [originalRoute, setOriginalRoute] = useState("");
  const [existing, setExisting] = useState<ApplicationDTO | null | undefined>(undefined); // undefined = loading
  const [declinedCount, setDeclinedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setExisting(undefined);
    setNote("");
    setOriginalNote("");
    setRoute("");
    setOriginalRoute("");
    fetch(`/api/groups/${group.id}/my-application`)
      .then((r) => r.json())
      .then((data) => {
        const app: ApplicationDTO | null = data.application ?? null;
        setExisting(app);
        setDeclinedCount(data.declinedCount ?? 0);
        if (app?.status === "pending" && app.note) {
          setNote(app.note);
          setOriginalNote(app.note);
        }
        if (app?.status === "pending" && app.route) {
          setRoute(app.route);
          setOriginalRoute(app.route);
        }
      })
      .catch(() => setExisting(null));
  }, [open, group.id]);

  if (!open) return null;

  const owner = current?.character;
  const specId = current?.specId ?? "";
  const role = (specById(specId)?.role ?? "DPS") as Role;
  const hasOpenSlot = owner ? group.slots.some((s) => s.role === role) : false;
  // M+ only, tank applicants only - lets the leader review a proposed pull
  // route before accepting. Optional; never shown for raid or non-tank.
  const showRoute = !isRaid && role === "TANK";

  const actualSpecIds = [...group.members.map((m) => m.broughtSpecId ?? m.specId), specId];
  const desiredSpecIds = [
    ...group.slots.flatMap((s) => s.prefs),
    ...group.combos.flatMap((c) => c.map((m) => m.specId)),
  ];
  const buffCoverage = computeBuffCoverage(actualSpecIds, desiredSpecIds);
  const utilityCoverage = computeUtilityCoverage(actualSpecIds, desiredSpecIds);
  const defensiveCoverage = computeDefensiveCoverage(actualSpecIds, desiredSpecIds);
  const externalDefensiveCoverage = computeExternalDefensiveCoverage(actualSpecIds, desiredSpecIds);
  const dispelCoverage = computeDispelCoverage(actualSpecIds, desiredSpecIds);
  const enemyDispelCoverage = computeEnemyDispelCoverage(actualSpecIds, desiredSpecIds);

  const submit = async () => {
    if (!owner) return;
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characterId: owner.id, specId, role,
          note: note.trim() || null,
          route: showRoute ? route.trim() || null : null,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const parsedError = (() => {
          try { return JSON.parse(body).error as string | undefined; } catch { return undefined; }
        })();
        setErr(
          res.status === 401
            ? "Session expired - log in again."
            : parsedError ?? `Apply failed (${res.status}). ${body.slice(0, 140)}`
        );
        return;
      }
      const data = await res.json();
      setExisting(data.application);
      setOriginalNote(note.trim());
      setOriginalRoute(route.trim());
      onApplied?.(data.application);
    } catch (e) {
      setErr(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pending = existing?.status === "pending";
  const outOfChances = existing?.status === "declined" && declinedCount >= MAX_APPLICATION_DECLINES;
  const resolved = existing?.status === "accepted" || outOfChances;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {isRaid ? (
            <>
              {raid?.icon && <WowIcon slug={raid.icon} size={20} cdnSize="small" rounded="sm" />}
              <span className="text-accent font-black text-xs uppercase tracking-wide">
                {group.raidDifficulty ? RAID_DIFFICULTY_LABEL[group.raidDifficulty as RaidDifficulty] : ""}
              </span>
              <span className="font-bold">{raid?.name ?? group.raidId}</span>
            </>
          ) : (
            <>
              <WowIcon slug={MISC_ICON.keystone} size={20} cdnSize="small" rounded="sm" />
              <span className="text-accent font-black tabular-nums">+{group.keyLevel}</span>
              <span className="font-bold">{dungeon?.name ?? group.dungeonId}</span>
            </>
          )}
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <p className="text-sm text-gray-300 -mt-2">{group.title}</p>

        {!owner ? (
          <p className="text-sm text-gray-400">
            Pick a current character in the navbar first.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <SpecIcon specId={specId} size={40} />
              <div>
                <div className="text-sm font-semibold">{owner.name} <span className="text-gray-500 text-xs">- {owner.realm}</span></div>
                <div className="text-xs text-gray-400">
                  Applying as {specById(specId)?.name}
                  {owner.ilvl != null && <> · {owner.ilvl} ilvl</>}
                </div>
              </div>
            </div>

            {hasOpenSlot ? (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                Fills the
                <RoleIcon role={role} size={14} rounded="sm" />
                <span className="text-gray-300 font-semibold">{ROLE_LABEL[role]}</span> slot.
              </p>
            ) : (
              <p className="text-xs text-rose-300">No open {ROLE_LABEL[role].toLowerCase()} slot in this group.</p>
            )}

            {showRoute && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Route (optional) - so the leader can review your pull plan
                </label>
                <textarea
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  maxLength={4000}
                  rows={3}
                  disabled={resolved}
                  placeholder="Paste your MDT route link or import string..."
                  className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-xs font-mono resize-none disabled:opacity-60"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
                disabled={resolved}
                placeholder="Anything the owner should know - availability, routing preference, etc."
                className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm resize-none disabled:opacity-60"
              />
            </div>

            <ApplyCoverageSection label="Buffs & Debuffs" have={buffCoverage.have} />
            <ApplyCoverageSection label="Utility" have={utilityCoverage.have} />
            <ApplyCoverageSection label="Friendly Dispels" have={dispelCoverage.have} />
            <ApplyCoverageSection label="Enemy Magic Dispels" have={enemyDispelCoverage.have} />
            <ApplyCoverageSection label="Party Defensives" have={defensiveCoverage.have} />
            <ApplyCoverageSection label="External Defensives" have={externalDefensiveCoverage.have} />

            {existing?.status === "declined" && !outOfChances && (
              <p className="text-xs text-amber-300">
                Declined last time - you can apply again ({MAX_APPLICATION_DECLINES - declinedCount} attempt{MAX_APPLICATION_DECLINES - declinedCount === 1 ? "" : "s"} left).
              </p>
            )}

            {err && <p className="text-rose-400 text-sm">{err}</p>}

            {existing === undefined ? (
              <button disabled className="btn-gold w-full opacity-60 cursor-wait">Loading…</button>
            ) : resolved ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide",
                  existing!.status === "accepted"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/50 bg-rose-500/10 text-rose-300"
                )}
              >
                {existing!.status === "accepted" ? "Application accepted" : "Declined twice - no more attempts"}
              </div>
            ) : (
              <button
                onClick={submit}
                disabled={
                  submitting ||
                  (pending && note.trim() === originalNote.trim() && (!showRoute || route.trim() === originalRoute.trim()))
                }
                className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending…" : existing?.status === "declined" ? "Apply again" : pending ? "Update application" : "Send application"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
