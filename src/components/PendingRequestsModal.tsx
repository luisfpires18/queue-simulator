"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/game/classes";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { usePendingApplications } from "@/lib/queries";
import { PaginationChips } from "./ui/PaginationChips";
import { RoleIcon } from "./RoleIcon";
import { RatingDetails } from "./RatingDetails";
import { cn } from "@/lib/utils";

type Tab = "ALL" | Role;

const TABS: Tab[] = ["ALL", "DPS", "TANK", "HEALER"];
const TAB_LABEL: Record<Tab, string> = { ALL: "All", TANK: "Tank", HEALER: "Healer", DPS: "DPS" };
const PAGE_SIZE = 5;

/** Owner-only: a paginated, role-tabbed modal of this group's pending
 * applications (an "All" tab first, then DPS/Tank/Healer filters), each
 * ranked by rating (highest first) with the applicant's rating details,
 * plus Accept/Decline. */
export function PendingRequestsModal({
  groupId, dungeonId, onResolved,
}: {
  groupId: string;
  dungeonId?: string | null;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Always mounted (never gated on `open`) so the badge count loads with the
  // card; tab/page changes re-key the query and fetch on their own.
  const { data, refetch } = usePendingApplications(groupId, activeTab, page, PAGE_SIZE);
  const apps = data?.applications ?? [];
  const total = data?.total ?? null; // null = not loaded yet (this tab)
  const countsByRole = data?.countsByRole ?? null;

  // Re-opening the modal always shows fresh data, like the old per-open load.
  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
  }

  async function resolve(id: string, action: "accept" | "decline") {
    setBusyId(id);
    setResolveError(null);
    try {
      await apiPost(`/api/applications/${id}/${action}`);
      // the accepted/declined row may have been the page's last one — step back if so
      const nextPage = apps.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      queryClient.invalidateQueries({ queryKey: ["pending-applications", groupId] });
      onResolved();
    } catch (e) {
      const fallback = `${action === "accept" ? "Accept" : "Decline"} failed.`;
      setResolveError(e instanceof ApiClientError ? e.message : fallback);
      return;
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const totalAcrossRoles = countsByRole ? countsByRole.TANK + countsByRole.HEALER + countsByRole.DPS : null;
  const tabCount = (tab: Tab) => (tab === "ALL" ? totalAcrossRoles : countsByRole?.[tab]) ?? 0;

  // Hides both while the count is still loading (null) and once it's
  // confirmed empty (0) - only null vs. 0 differ, but treating them the same
  // here matters: rendering the chip on `null` was the flicker bug (it'd
  // show unconditionally for an instant on every page load, then vanish the
  // moment the real count - often 0 - came back).
  if (!totalAcrossRoles) return null;

  return (
    <>
      <button
        onClick={() => { setPage(1); setOpen(true); }}
        className="chip border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
      >
        Pending Requests{totalAcrossRoles != null && ` (${totalAcrossRoles})`}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            className="panel w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Pending Requests</span>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>

            {resolveError && (
              <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">
                {resolveError}
              </p>
            )}

            <div className="flex gap-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={cn(
                    "flex items-center gap-1.5 chip border flex-1 justify-center",
                    activeTab === tab ? "border-accent text-accent bg-accent/10" : "border-panelborder text-gray-400"
                  )}
                >
                  {tab !== "ALL" && <RoleIcon role={tab} size={14} rounded="sm" />}
                  {TAB_LABEL[tab]}
                  <span className="text-[10px] opacity-70">({tabCount(tab)})</span>
                </button>
              ))}
            </div>

            {apps.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No pending {activeTab === "ALL" ? "" : `${TAB_LABEL[activeTab].toLowerCase()} `}applications.
              </p>
            ) : (
              <div className="space-y-3">
                {apps.map((a) => {
                  const busy = busyId === a.id;
                  return (
                    <div key={a.id} className="rounded-md border border-panelborder bg-panel2/60 p-2.5 space-y-2">
                      {(activeTab === "ALL" || a.source === "queue") && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          {activeTab === "ALL" && (
                            <>
                              <RoleIcon role={a.role as Role} size={12} rounded="sm" />
                              {TAB_LABEL[a.role as Role]}
                            </>
                          )}
                          {a.source === "queue" && (
                            <span
                              className="chip border border-accent/50 bg-accent/10 text-accent"
                              title="Proposed automatically by Solo Queue, not applied for directly."
                            >
                              Suggested
                            </span>
                          )}
                        </div>
                      )}
                      {a.rankedByMain && (
                        <div
                          className="flex items-center gap-1 text-[10px] text-amber-300"
                          title="Ranked by their main spec's rating — they're applying with a different (lower-rated) spec."
                        >
                          ⚠ Ranked by main spec
                        </div>
                      )}
                      <RatingDetails
                        name={a.characterName}
                        realm={a.characterRealm}
                        realmSlug={a.characterRealmSlug}
                        region={a.characterRegion}
                        classId={a.classId}
                        ilvl={a.characterIlvl}
                        specId={a.specId}
                        specTracks={a.specTracks}
                        forDungeonId={dungeonId ?? undefined}
                        raidKills={a.characterRaidKills}
                        raidGridDefaultOpen={false}
                        meetsRequirement={a.meetsRequirement}
                      />
                      {a.role === "TANK" && a.route && (
                        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-2 space-y-1">
                          <div className="text-[10px] uppercase tracking-wide text-sky-300">🗺️ Proposed route</div>
                          <p className="text-xs text-gray-200 font-mono break-all whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {a.route}
                          </p>
                        </div>
                      )}
                      {a.note && (
                        <p className="text-xs text-gray-300 rounded-md border border-panelborder bg-panel2/40 p-2 italic">
                          &ldquo;{a.note}&rdquo;
                        </p>
                      )}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => resolve(a.id, "accept")}
                          disabled={busy}
                          className="chip border flex-1 justify-center border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => resolve(a.id, "decline")}
                          disabled={busy}
                          className="chip border flex-1 justify-center border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <PaginationChips
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="pt-1"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
