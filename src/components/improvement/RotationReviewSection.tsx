"use client";

import { Section } from "./Section";
import type { TimelineMarker } from "./TimelineSvg";

// Server-computed shape from checkRotation() in src/server/analysis/rotationRules.js.
// Kept loose for the same reason as ReportView's own view model: this is a
// rendering layer over data the server already validated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Review = any;

const SEVERITY_STYLE: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "text-red-400" },
  medium: { label: "Medium", className: "text-amber-400" },
  low: { label: "Low", className: "text-gray-400" },
};

/**
 * Timeline markers for every flagged moment, so the ticks above line up with the
 * findings below. Only my run gets these - the review judges my run.
 */
export function reviewMarkers(review: Review): TimelineMarker[] {
  if (!review?.findings?.length) return [];
  return review.findings.flatMap((f: any) =>
    (f.atMs ?? []).map((atMs: number) => ({ atMs, label: f.title }))
  );
}

export function RotationReviewSection({
  review,
  seasonPatch,
}: {
  review: Review;
  /** The patch the app's current season is on, for the stale-pack check. */
  seasonPatch?: string;
}) {
  // Null for every spec with no rule pack yet, which is all but Unholy DK.
  if (!review) return null;

  const stale = Boolean(seasonPatch && review.patch && seasonPatch !== review.patch);
  const findings = review.findings ?? [];
  const skipped = review.skipped ?? [];

  return (
    <Section
      title="Rotation review"
      sub={`${review.specLabel} - ${review.build?.label ?? "unknown build"}, patch ${review.patch}`}
    >
      {/* This section is the one place in the report that judges you against
          outside rotation guides rather than against another player, so it says
          so plainly and links what it used. */}
      <p className="text-[11px] text-gray-500 mb-2">
        Judged against the published rotation for your spec, not against another player.
        Sources:{" "}
        {(review.sources ?? []).map((s: any, i: number) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {s.label}
            </a>
          </span>
        ))}
        . Everything below is measured against your <b>engaged</b> time, so seconds spent walking
        between pulls are never counted against you.
        {review.build?.detected === false && (
          <> Your hero talent build could not be read from this log, so {review.build?.label} was assumed.</>
        )}
      </p>

      {stale && (
        <p className="text-xs text-amber-400 mb-2">
          These rules were written for patch {review.patch} but the season is on {seasonPatch}. Treat
          the findings as out of date until the rule pack is refreshed.
        </p>
      )}

      {findings.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing in your rotation broke the {review.rulesChecked} rule
          {review.rulesChecked === 1 ? "" : "s"} checked for this spec.
        </p>
      ) : (
        <ol className="space-y-3">
          {findings.map((f: any) => {
            const sev = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.low;
            return (
              <li key={f.id}>
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className={`text-xs font-bold ${sev.className}`}>{sev.label}</span>
                  <b>{f.title}</b>
                  {f.evidence && (
                    <span className="text-gray-400 text-xs tabular-nums">
                      {f.evidence.measured} vs target {f.evidence.expected}
                      {f.evidence.unit ? ` ${f.evidence.unit}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{f.detail}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 italic">
                  {f.why}
                  {f.source && (
                    <>
                      {" "}
                      <a href={f.source.url} target="_blank" rel="noreferrer" className="text-accent not-italic hover:underline">
                        ({f.source.label})
                      </a>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {skipped.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-accent">
            {skipped.length} rule{skipped.length === 1 ? "" : "s"} could not be measured
          </summary>
          <ul className="mt-1 space-y-1">
            {skipped.map((s: any) => (
              <li key={s.ruleId} className="text-[11px] text-gray-500">
                <b className="text-gray-400">{s.title}</b> - {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}
