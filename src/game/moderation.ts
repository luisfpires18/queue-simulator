// Moderation vocabulary. Pure data, no I/O - same role recruitmentTypes.ts
// plays for the recruitment forms.

export type ReportCategory = "boosting" | "gold_selling" | "spam" | "harassment" | "other";

/** The categories the product explicitly prohibits, plus the general ones.
 * `hint` is shown under each option in the report form, because the boosting
 * line is exactly where users guess wrong in both directions. */
export const REPORT_CATEGORY_OPTIONS = [
  {
    value: "boosting",
    label: "Paid carry or boosting",
    hint: "Selling runs, carries, or advertising a boosting service.",
  },
  {
    value: "gold_selling",
    label: "Gold selling or RMT",
    hint: "Real-money trading, gold sales, or account sharing and piloting.",
  },
  { value: "spam", label: "Spam or duplicate posts", hint: "Repeated or off-topic recruitment posts." },
  {
    value: "harassment",
    label: "Harassment or abuse",
    hint: "Abusive messages, or contact after being asked to stop.",
  },
  { value: "other", label: "Something else", hint: "Anything not covered above." },
] as const satisfies readonly { value: ReportCategory; label: string; hint: string }[];

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = Object.fromEntries(
  REPORT_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<ReportCategory, string>;

export type ReportTargetType = "user" | "mplus_post" | "guild" | "raid_team" | "application";

export const REPORT_TARGET_TYPES: readonly ReportTargetType[] = [
  "user",
  "mplus_post",
  "guild",
  "raid_team",
  "application",
];

export type ReportStatus = "open" | "reviewed" | "actioned" | "dismissed";

/** Shown above the report form. Stated positively as well as negatively
 * because the spec is explicit that ordinary guild recruitment, unpaid
 * mentoring and helping friends must NOT be treated as boosting - and a report
 * form that only lists prohibitions trains people to flag all three. */
export const REPORTING_GUIDANCE =
  "Report paid carries, gold selling, account sharing, spam or abuse. Normal guild and team recruitment, " +
  "helping friends, and unpaid coaching are all fine and should not be reported.";

export const MAX_REPORT_DETAIL = 1000;
export const MAX_BLOCK_REASON = 200;
