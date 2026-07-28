"use client";

import { useState } from "react";
import type { DeclineSide } from "@/data/declineRecords";
import { CLASS_BY_ID, specById, type ClassId, type Role } from "@/game/classes";
import { useDeclineHistory, type DeclineHistoryResponse } from "@/lib/queries";
import { PaginationChips } from "@/components/ui/PaginationChips";
import { RoleIcon } from "@/components/RoleIcon";
import { SpecIcon } from "@/components/SpecIcon";
import { cn } from "@/lib/utils";

const LISTING_LABEL: Record<string, string> = { mplus: "Key", raid: "Raid", team: "Team" };

/** Both halves of the decline history. Private - the route only ever reads
 * the caller's own rows, and none of this appears on a public profile.
 * `initialData` (from the profile page's server render, for the default
 * received/page-1 view) makes opening this tab show real data immediately
 * instead of flashing "Loading…" every time - see useDeclineHistory. */
export function FeedbackTab({ initialData }: { initialData?: DeclineHistoryResponse }) {
  const [side, setSide] = useState<DeclineSide>("received");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDeclineHistory(side, page, initialData);

  const records = data?.records ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const switchSide = (next: DeclineSide) => {
    setSide(next);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["received", "given"] as DeclineSide[]).map((s) => (
          <button
            key={s}
            onClick={() => switchSide(s)}
            className={cn("chip border", side === s ? "border-accent text-accent bg-accent/10" : "border-panelborder text-gray-400")}
          >
            {s === "received" ? "Declines you received" : "Declines you gave"}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <div className="panel p-10 text-center text-gray-500">Loading…</div>
      ) : records.length === 0 ? (
        <div className="panel p-10 text-center text-gray-500">
          {side === "received" ? "Nobody has declined you." : "You haven't declined anyone."}
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const cls = CLASS_BY_ID[r.classId as ClassId];
            const spec = specById(r.specId);
            const who = r.counterparty.characterName ?? r.counterparty.battletag ?? "Someone";
            return (
              <div key={r.id} className="panel p-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  {spec ? <SpecIcon specId={r.specId} size={32} /> : <RoleIcon role={r.role as Role} size={32} rounded="sm" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200">
                      {side === "received" ? (
                        <>
                          <span className="font-semibold">{who}</span> declined you for{" "}
                          <span className="font-semibold">{r.listingTitle}</span>
                        </>
                      ) : (
                        <>
                          You declined <span className="font-semibold" style={{ color: cls?.color }}>{r.characterName}</span> for{" "}
                          <span className="font-semibold">{r.listingTitle}</span>
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="chip border border-panelborder text-gray-400">
                        {LISTING_LABEL[r.listingKind] ?? r.listingKind}
                      </span>
                      <span className="chip border border-rose-500/40 text-rose-300">{r.reasonLabel}</span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
                {r.note && (
                  <p className="text-xs text-gray-300 rounded-md border border-panelborder bg-panel2/40 p-2 italic whitespace-pre-wrap">
                    &ldquo;{r.note}&rdquo;
                  </p>
                )}
                <p className="text-[11px] text-gray-600">
                  {side === "received" ? "Applied as" : "They applied as"} {r.characterName} - {r.characterRealm}
                </p>
              </div>
            );
          })}

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
      )}
    </div>
  );
}
