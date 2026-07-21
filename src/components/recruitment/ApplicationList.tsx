"use client";

import { useMemo, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { classById, specById } from "@/game/classes";
import { formatSlots } from "@/game/availability";
import { formatListingAge } from "@/game/expiry";
import {
  STATUS_LABEL,
  nextStatuses,
  type ApplicationStatus,
} from "@/game/applicationStatus";
import {
  compatibilityBucket,
  explainApplication,
  fairOrder,
  type MatchFacet,
  type TeamProfile,
} from "@/game/recruitmentMatch";
import { SpecIcon } from "@/components/SpecIcon";
import { RatingBadge } from "@/components/RatingBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import { CompatibilityHeading, MatchFacets } from "./MatchFacets";
import { BlockReportMenu } from "./BlockReportMenu";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

/** The recruiter's queue for one listing.
 *
 * Candidates are GROUPED by how many dimensions matched and ordered within
 * each group by fairOrder - application time, then recent activity, then a
 * stable jitter. Explicitly not sorted by rating and not by logs: that is the
 * fairness rule this whole feature is built around, and it is why there is no
 * "sort by score" control here.
 */
export function ApplicationList({
  applications,
  post,
  facetsById,
  onChanged,
}: {
  applications: RecruitmentApplicationDTO[];
  /** M+ listings are explained here, against the post's own schedule, goal and
   * key range. */
  post?: MPlusRecruitmentPostDTO;
  /** Guild applications are explained by the caller instead: they need the
   * applicant's raider profile and the team's raid nights, neither of which
   * this component has. Either source produces the same MatchFacet[]. */
  facetsById?: Map<string, MatchFacet[]>;
  onChanged: (application: RecruitmentApplicationDTO) => void;
}) {
  const grouped = useMemo(() => {
    const team: TeamProfile | null = post
      ? {
          availability: post.availability,
          languages: post.languages,
          goal: post.goal,
          currentKeyMin: post.currentKeyMin,
          currentKeyMax: post.currentKeyMax,
          targetKeyMin: post.targetKeyMin,
          targetKeyMax: post.targetKeyMax,
          voiceRequired: post.voiceRequired,
          positions: post.positions,
        }
      : null;

    const withFacets = applications.map((a) => {
      const facets: MatchFacet[] = facetsById?.get(a.id) ?? (team
        ? explainApplication(
            {
              primarySpecId: a.specId,
              alternateSpecIds: a.alternateSpecIds,
              preferredRole: a.role,
              willingRoles: [],
              availability: a.availability,
              languages: post?.languages ?? [],
              hasVoice: true,
            },
            team
          )
        : []);
      return { application: a, facets, bucket: compatibilityBucket(facets) };
    });

    // Bucket descending, then fairOrder within each bucket. The seed rotates
    // daily so equally-matched candidates take turns at the top rather than
    // one person permanently owning it.
    const seed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const buckets = new Map<number, typeof withFacets>();
    for (const row of withFacets) {
      const list = buckets.get(row.bucket) ?? [];
      list.push(row);
      buckets.set(row.bucket, list);
    }

    return [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([bucket, rows]) => ({
        bucket,
        rows: fairOrder(
          rows.map((r) => ({ ...r, id: r.application.id, createdAt: r.application.createdAt })),
          seed
        ),
      }));
  }, [applications, post, facetsById]);

  if (!applications.length) {
    return (
      <EmptyState
        title="No applications yet"
        body="When someone applies to this listing they will appear here, grouped by how well they match."
      />
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ bucket, rows }) => (
        <section key={bucket}>
          {/* Only worth a heading when there is more than one group to tell apart. */}
          {grouped.length > 1 && <CompatibilityHeading strongCount={bucket} count={rows.length} />}
          <div className="space-y-2">
            {rows.map((row) => (
              <ApplicationCard
                key={row.application.id}
                application={row.application}
                facets={row.facets}
                onChanged={onChanged}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ApplicationCard({
  application,
  facets,
  onChanged,
}: {
  application: RecruitmentApplicationDTO;
  facets: MatchFacet[];
  onChanged: (a: RecruitmentApplicationDTO) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(application.recruiterNote ?? "");

  const spec = specById(application.specId);
  const actions = nextStatuses(application.status, application.recruitmentType, "recruiter");

  async function move(status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ application: RecruitmentApplicationDTO }>(
        `/api/recruitment/applications/${application.id}`,
        { status },
        "PATCH"
      );
      onChanged(res.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the application.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    setBusy(true);
    try {
      await apiPost(
        `/api/recruitment/applications/${application.id}`,
        { recruiterNote: note.trim() || null },
        "PATCH"
      );
      setNoteOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel p-4">
      <div className="flex items-start gap-3">
        <SpecIcon specId={application.specId} size={32} showRole title={spec?.name} />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold"
            style={{ color: classById(application.character.classId)?.color }}
          >
            {application.character.name}
          </p>
          <p className="truncate text-xs text-gray-500">
            {spec?.name} · {ROLE_LABEL[application.role] ?? application.role} ·{" "}
            {application.character.realm}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {application.character.rating != null && (
            <RatingBadge rating={application.character.rating} size="sm" />
          )}
          <span className="chip bg-panel2 text-gray-300">
            {STATUS_LABEL[application.status as ApplicationStatus] ?? application.status}
          </span>
          <BlockReportMenu
            targetUserId={application.applicantUserId}
            targetType="application"
            targetId={application.id}
          />
        </div>
      </div>

      {facets.length > 0 && <MatchFacets facets={facets} compact className="mt-3" />}

      {application.availability.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">{formatSlots(application.availability)}</p>
      )}

      {application.note && (
        <p className="mt-2 whitespace-pre-wrap rounded border border-panelborder bg-panel2/50 p-2 text-xs text-gray-300">
          {application.note}
        </p>
      )}

      {application.recruiterNote && !noteOpen && (
        <p className="mt-2 text-xs text-gray-500">
          <span className="text-gray-600">Private note:</span> {application.recruiterNote}
        </p>
      )}

      {noteOpen && (
        <div className="mt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Only you can see this."
            className="w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={saveNote} disabled={busy} className="btn-gold">
              Save note
            </button>
            <button type="button" onClick={() => setNoteOpen(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Only offers transitions the server will accept - nextStatuses and
            canActorTransition share the same table. */}
        {actions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => move(status)}
            disabled={busy}
            className={status === "accepted" ? "btn-gold" : "btn-ghost"}
          >
            {actionLabel(status)}
          </button>
        ))}
        {!noteOpen && (
          <button type="button" onClick={() => setNoteOpen(true)} className="btn-ghost">
            {application.recruiterNote ? "Edit note" : "Add note"}
          </button>
        )}
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

/** Imperative wording for a button, rather than the status noun. */
function actionLabel(status: string): string {
  switch (status) {
    case "shortlisted":
      return "Shortlist";
    case "under_review":
      return "Mark under review";
    case "interview_requested":
      return "Request interview";
    case "trial_offered":
      return "Offer trial";
    case "trial_active":
      return "Start trial";
    case "accepted":
      return "Accept";
    case "declined":
      return "Decline";
    default:
      return STATUS_LABEL[status as ApplicationStatus] ?? status;
  }
}
