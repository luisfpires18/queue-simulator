"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";
import { classById, specById } from "@/game/classes";
import { formatListingAge } from "@/game/expiry";
import {
  STATUS_HINT,
  STATUS_LABEL,
  isTerminal,
  nextStatuses,
  type ApplicationStatus,
} from "@/game/applicationStatus";
import { SpecIcon } from "@/components/SpecIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

/** The applicant's own view of everywhere they have applied.
 *
 * Leads with what the status MEANS rather than just naming it - "Trial
 * offered" alone does not tell someone they need to do something. */
export function MyApplications({
  applications,
  onChanged,
}: {
  applications: RecruitmentApplicationDTO[];
  onChanged: (a: RecruitmentApplicationDTO) => void;
}) {
  if (!applications.length) {
    return (
      <EmptyState
        title="You have not applied to anything yet"
        body="Applications you send appear here, with their status and anything the team needs from you."
        action={
          <Link href="/recruitment" className="btn-gold">
            Browse teams
          </Link>
        }
      />
    );
  }

  // Live applications first - a wall of old declines above the one that needs
  // an answer would be the wrong order.
  const sorted = [...applications].sort((a, b) => {
    const at = isTerminal(a.status) ? 1 : 0;
    const bt = isTerminal(b.status) ? 1 : 0;
    if (at !== bt) return at - bt;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  return (
    <div className="space-y-2">
      {sorted.map((a) => (
        <MyApplicationCard key={a.id} application={a} onChanged={onChanged} />
      ))}
    </div>
  );
}

function MyApplicationCard({
  application,
  onChanged,
}: {
  application: RecruitmentApplicationDTO;
  onChanged: (a: RecruitmentApplicationDTO) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = specById(application.specId);
  const status = application.status as ApplicationStatus;
  const actions = nextStatuses(application.status, application.recruitmentType, "applicant");
  const settled = isTerminal(application.status);

  async function move(next: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ application: RecruitmentApplicationDTO }>(
        `/api/recruitment/applications/${application.id}`,
        { status: next },
        "PATCH"
      );
      onChanged(res.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`panel p-4 ${settled ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <SpecIcon specId={application.specId} size={28} showRole title={spec?.name} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: classById(application.character.classId)?.color }}
          >
            {application.character.name}
          </p>
          <p className="truncate text-xs text-gray-500">
            {spec?.name} · {ROLE_LABEL[application.role] ?? application.role}
          </p>
        </div>
        <span className="chip shrink-0 bg-panel2 text-gray-300">
          {STATUS_LABEL[status] ?? application.status}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-400">{STATUS_HINT[status]}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {application.recruitmentType === "mplus" && (
          <Link href={`/recruitment/${application.targetId}`} className="btn-ghost">
            View listing
          </Link>
        )}
        {actions.map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => move(next)}
            disabled={busy}
            className={next === "trial_accepted" ? "btn-gold" : "btn-ghost"}
          >
            {next === "trial_accepted" ? "Accept trial" : "Withdraw"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-600">
          Applied {formatListingAge(application.createdAt).toLowerCase()}
        </span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
