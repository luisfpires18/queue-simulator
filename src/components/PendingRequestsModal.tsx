"use client";

import { useEffect, useState } from "react";
import type { ApplicationWithRatingDTO } from "@/data/source";
import type { Role } from "@/game/classes";
import { RoleIcon } from "./RoleIcon";
import { RatingDetails } from "./RatingDetails";
import { cn } from "@/lib/utils";

type Tab = "ALL" | Role;

const TABS: Tab[] = ["ALL", "DPS", "TANK", "HEALER"];
const TAB_LABEL: Record<Tab, string> = { ALL: "All", TANK: "Tank", HEALER: "Healer", DPS: "DPS" };
const PAGE_SIZE = 5;
const EMPTY_COUNTS: Record<Role, number> = { TANK: 0, HEALER: 0, DPS: 0 };

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
  const [apps, setApps] = useState<ApplicationWithRatingDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null); // null = not loaded yet (this tab)
  const [countsByRole, setCountsByRole] = useState<Record<Role, number> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load(tab: Tab, p: number) {
    const roleParam = tab === "ALL" ? "" : `&role=${tab}`;
    fetch(`/api/groups/${groupId}/applications?page=${p}&pageSize=${PAGE_SIZE}${roleParam}`)
      .then((r) => r.json())
      .then((data) => {
        setApps(data.applications ?? []);
        setTotal(data.total ?? 0);
        setCountsByRole(data.countsByRole ?? EMPTY_COUNTS);
      })
      .catch(() => {});
  }

  // Badge counts on mount, regardless of whether the modal's open.
  useEffect(() => {
    load(activeTab, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (open) load(activeTab, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, page]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
  }

  async function resolve(id: string, action: "accept" | "decline") {
    setBusyId(id);
    try {
      await fetch(`/api/applications/${id}/${action}`, { method: "POST" });
      // the accepted/declined row may have been the page's last one — step back if so
      const nextPage = apps.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      load(activeTab, nextPage);
      onResolved();
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const totalAcrossRoles = countsByRole ? countsByRole.TANK + countsByRole.HEALER + countsByRole.DPS : null;
  const tabCount = (tab: Tab) => (tab === "ALL" ? totalAcrossRoles : countsByRole?.[tab]) ?? 0;

  if (totalAcrossRoles === 0) return null;

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
                      {activeTab === "ALL" && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <RoleIcon role={a.role as Role} size={12} rounded="sm" />
                          {TAB_LABEL[a.role as Role]}
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
                        meetsRequirement={a.meetsRequirement}
                      />
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
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={cn("chip border border-panelborder text-gray-400", page <= 1 ? "opacity-40" : "hover:bg-panel2")}
                >
                  ← Prev
                </button>
                <span className="text-[11px] text-gray-500">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={cn("chip border border-panelborder text-gray-400", page >= totalPages ? "opacity-40" : "hover:bg-panel2")}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
