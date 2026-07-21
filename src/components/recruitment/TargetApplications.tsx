"use client";

import { useState } from "react";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import { ApplicationList } from "./ApplicationList";

/** The owner's applicant queue on their own listing page.
 *
 * Holds the list in state so accepting or declining updates in place rather
 * than needing a reload - the recruiter is usually working through several in
 * a row. */
export function TargetApplications({
  post,
  initialApplications,
}: {
  post: MPlusRecruitmentPostDTO;
  initialApplications: RecruitmentApplicationDTO[];
}) {
  const [applications, setApplications] = useState(initialApplications);

  function onChanged(updated: RecruitmentApplicationDTO) {
    setApplications((all) =>
      all
        .map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
        // Settled applications drop out of the active queue. They are still
        // reachable via the ?all=1 read, which the tab view uses.
        .filter((a) => !["declined", "withdrawn", "expired"].includes(a.status))
    );
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
        Applications
        {applications.length > 0 && (
          <span className="ml-2 rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-semibold text-gray-300">
            {applications.length}
          </span>
        )}
      </h2>
      <ApplicationList applications={applications} post={post} onChanged={onChanged} />
    </section>
  );
}
