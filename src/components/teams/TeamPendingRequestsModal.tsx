"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/game/classes";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { usePendingTeamApplications } from "@/lib/queries";
import { PaginationChips } from "@/components/ui/PaginationChips";
import { DeclineDialog } from "@/components/DeclineDialog";
import { RoleIcon } from "@/components/RoleIcon";
import { RatingDetails } from "@/components/RatingDetails";
import { cn } from "@/lib/utils";

type Tab = "ALL" | Role;

const TABS: Tab[] = ["ALL", "DPS", "TANK", "HEALER"];
const TAB_LABEL: Record<Tab, string> = { ALL: "All", TANK: "Tank", HEALER: "Healer", DPS: "DPS" };
const PAGE_SIZE = 5;

/** Owner-only: paginated, role-tabbed review of a team's pending
 * applications. Same structure as the group-listing equivalent; a team has no
 * dungeon context and no proposed-route field, so those columns are absent. */
export function TeamPendingRequestsModal({
  teamId, initialCount, onResolved,
}: {
  teamId: string;
  /** Server-rendered pending count (see getPendingCountsByTeam) - lets the
   * badge render in the first paint rather than after a client fetch. */
  initialCount?: number;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  // The applicant whose decline dialog is open - declining needs a reason.
  const [declining, setDeclining] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  // The trigger + badge are always mounted (initialCount seeds it), but the
  // list itself only fetches once the modal is open - see the same note on
  // PendingRequestsModal.
  const { data } = usePendingTeamApplications(teamId, activeTab, page, PAGE_SIZE, open);
  const apps = data?.applications ?? [];
  const total = data?.total ?? null;
  const countsByRole = data?.countsByRole ?? null;

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
  }

  async function resolve(id: string, action: "accept" | "decline", payload?: unknown) {
    setBusyId(id);
    setResolveError(null);
    try {
      await apiPost(`/api/team-applications/${id}/${action}`, payload);
      const nextPage = apps.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      setDeclining(null);
      queryClient.invalidateQueries({ queryKey: ["pending-team-applications", teamId] });
      onResolved();
    } catch (e) {
      setResolveError(e instanceof ApiClientError ? e.message : `${action === "accept" ? "Accept" : "Decline"} failed.`);
      return;
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  // Falls back to the server-rendered count until the query resolves.
  const totalAcrossRoles = countsByRole
    ? countsByRole.TANK + countsByRole.HEALER + countsByRole.DPS
    : initialCount ?? null;
  const tabCount = (tab: Tab) => (tab === "ALL" ? totalAcrossRoles : countsByRole?.[tab]) ?? 0;

  // Hidden both while the count is unknown (null) and once it's confirmed 0 -
  // rendering on null is what causes the badge to flicker in and out.
  if (!totalAcrossRoles) return null;

  return (
    <>
      <button
        onClick={() => { setPage(1); setOpen(true); }}
        className="chip border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
      >
        Applications ({totalAcrossRoles})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Applications</span>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>

            {resolveError && (
              <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{resolveError}</p>
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
                        raidKills={a.characterRaidKills}
                        raidGridDefaultOpen={false}
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
                          onClick={() => setDeclining({ id: a.id, name: a.characterName })}
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

      <DeclineDialog
        open={declining !== null}
        applicantName={declining?.name ?? ""}
        submitting={busyId != null}
        onCancel={() => setDeclining(null)}
        onConfirm={(reasonId, note) => declining && resolve(declining.id, "decline", { reasonId, note })}
      />
    </>
  );
}
