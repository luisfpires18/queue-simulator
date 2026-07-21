"use client";

import { useState } from "react";
import Link from "next/link";
import { STATUS_HINT, STATUS_LABEL, isTerminal, type ApplicationStatus } from "@/game/applicationStatus";
import type { CharacterDTO } from "@/data/dto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import { ApplyModal, type ApplyTargetPosition } from "./ApplyModal";
import { BlockReportMenu } from "./BlockReportMenu";
import type { ReportTargetType } from "@/game/moderation";

/** The apply call-to-action on a listing detail page, plus the state once the
 * viewer has already applied. Replaces the Phase 1 "use the contact details in
 * the description" placeholder on both the M+ and guild sides. */
export function ApplySection({
  recruitmentType,
  targetId,
  targetName,
  ownerUserId,
  positions,
  characters,
  initialApplication,
  signedIn,
  isOwner,
}: {
  recruitmentType: "mplus" | "guild";
  targetId: string;
  targetName: string;
  ownerUserId: string;
  positions: ApplyTargetPosition[];
  characters: CharacterDTO[];
  initialApplication: RecruitmentApplicationDTO | null;
  signedIn: boolean;
  isOwner: boolean;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [open, setOpen] = useState(false);

  // The owner sees their own applicant queue elsewhere; offering them an
  // Apply button on their own listing would be nonsense.
  if (isOwner) return null;

  if (!signedIn) {
    return (
      <Section>
        <p className="text-sm text-gray-500">
          <Link href="/api/auth/signin" className="text-accent hover:brightness-110">
            Sign in
          </Link>{" "}
          to apply to this listing.
        </p>
      </Section>
    );
  }

  const live = application && !isTerminal(application.status);

  return (
    <Section
      action={
        <BlockReportMenu
          targetUserId={ownerUserId}
          targetType={(recruitmentType === "guild" ? "raid_team" : "mplus_post") as ReportTargetType}
          targetId={targetId}
        />
      }
    >
      {live ? (
        <div>
          <p className="text-sm text-gray-200">
            You applied - {STATUS_LABEL[application!.status as ApplicationStatus]}
          </p>
          <p className="mt-1 text-xs text-gray-500">{STATUS_HINT[application!.status as ApplicationStatus]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
              Update application
            </button>
            <Link href="/recruitment?tab=applications" className="btn-ghost">
              My applications
            </Link>
          </div>
        </div>
      ) : (
        <div>
          {application && (
            // A settled application is stated rather than hidden, so re-applying
            // is a deliberate act and not a confusing repeat.
            <p className="mb-2 text-xs text-gray-500">
              Your previous application was {STATUS_LABEL[application.status as ApplicationStatus]?.toLowerCase()}.
            </p>
          )}
          <button type="button" onClick={() => setOpen(true)} className="btn-gold">
            Apply
          </button>
        </div>
      )}

      <ApplyModal
        open={open}
        onClose={() => setOpen(false)}
        recruitmentType={recruitmentType}
        targetId={targetId}
        targetName={targetName}
        positions={positions}
        characters={characters}
        existing={live ? application : null}
        onApplied={setApplication}
      />
    </Section>
  );
}

function Section({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Applying</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
