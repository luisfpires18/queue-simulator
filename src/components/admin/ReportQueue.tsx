"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import { REPORT_CATEGORY_LABEL, type ReportCategory } from "@/game/moderation";
import { formatListingAge } from "@/game/expiry";
import { EmptyState } from "@/components/ui/EmptyState";

export interface AdminReport {
  id: string;
  reporterBattletag: string | null;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  category: string;
  detail: string | null;
  status: string;
  createdAt: string;
}

const TARGET_LABEL: Record<string, string> = {
  user: "User",
  mplus_post: "M+ post",
  guild: "Guild",
  raid_team: "Raid team",
  application: "Application",
};

/** Link to the reported thing where one exists, so a moderator can look at it
 * before deciding. Applications and users have no public page. */
function targetHref(r: AdminReport): string | null {
  if (r.targetType === "mplus_post") return `/recruitment/${r.targetId}`;
  if (r.targetType === "guild") return `/guilds/${r.targetId}`;
  return null;
}

export function ReportQueue({ initial }: { initial: AdminReport[] }) {
  const [reports, setReports] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(reportId: string, status: string) {
    setBusyId(reportId);
    setError(null);
    try {
      await apiPost("/api/admin/reports", { reportId, status }, "PATCH");
      // Drops out of the open queue once handled.
      setReports((all) => all.filter((r) => r.id !== reportId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that report.");
    } finally {
      setBusyId(null);
    }
  }

  if (!reports.length) {
    return <EmptyState title="Nothing to review" body="No open reports right now." />;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="panel px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {reports.map((r) => {
        const href = targetHref(r);
        return (
          <article key={r.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">
                  {REPORT_CATEGORY_LABEL[r.category as ReportCategory] ?? r.category}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {TARGET_LABEL[r.targetType] ?? r.targetType}:{" "}
                  {r.targetLabel ? (
                    href ? (
                      <Link href={href} className="text-accent hover:brightness-110">
                        {r.targetLabel}
                      </Link>
                    ) : (
                      <span className="text-gray-300">{r.targetLabel}</span>
                    )
                  ) : (
                    // The reported thing is gone - worth saying, since it
                    // usually means the problem resolved itself.
                    <span className="text-gray-600">no longer exists</span>
                  )}
                </p>
              </div>
              <span className="text-[11px] text-gray-600">
                {formatListingAge(r.createdAt).toLowerCase()}
              </span>
            </div>

            {r.detail && (
              <p className="mt-3 whitespace-pre-wrap rounded border border-panelborder bg-panel2/50 p-2 text-xs text-gray-300">
                {r.detail}
              </p>
            )}

            <p className="mt-2 text-[11px] text-gray-600">
              Reported by {r.reporterBattletag ?? "unknown"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => resolve(r.id, "actioned")}
                disabled={busyId === r.id}
                className="btn-gold"
              >
                Actioned
              </button>
              <button
                type="button"
                onClick={() => resolve(r.id, "reviewed")}
                disabled={busyId === r.id}
                className="btn-ghost"
              >
                Reviewed, no action
              </button>
              <button
                type="button"
                onClick={() => resolve(r.id, "dismissed")}
                disabled={busyId === r.id}
                className="btn-ghost"
              >
                Dismiss
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
