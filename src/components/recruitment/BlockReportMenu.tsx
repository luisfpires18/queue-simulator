"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { apiPost } from "@/lib/api-client";
import {
  REPORTING_GUIDANCE,
  REPORT_CATEGORY_OPTIONS,
  MAX_REPORT_DETAIL,
  type ReportCategory,
  type ReportTargetType,
} from "@/game/moderation";

/** Block and report, behind an overflow menu so the actions exist everywhere
 * a user appears without shouting on every card.
 *
 * Blocking is deliberately reachable in one step from wherever someone
 * contacted you - a safety control buried in settings is one people cannot
 * find at the moment they need it. */
export function BlockReportMenu({
  targetUserId,
  targetType,
  targetId,
}: {
  /** The account being blocked. Reporting can target a listing instead, but a
   * block is always against a person. */
  targetUserId: string;
  targetType: ReportTargetType;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleBlock() {
    setBusy(true);
    try {
      await apiPost("/api/moderation/block", { blockedUserId: targetUserId, blocked: !blocked });
      setBlocked((b) => !b);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
        className="rounded p-1 text-gray-500 hover:bg-panel2 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-panelborder bg-panel shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setReporting(true);
              setOpen(false);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-panel2"
          >
            Report
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={toggleBlock}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-panel2"
          >
            {blocked ? "Unblock user" : "Block user"}
          </button>
        </div>
      )}

      <ReportModal
        open={reporting}
        onClose={() => setReporting(false)}
        targetType={targetType}
        targetId={targetId}
      />
    </div>
  );
}

function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
}) {
  const [category, setCategory] = useState<ReportCategory>("boosting");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/moderation/report", { targetType, targetId, category, detail: detail.trim() || null });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-md p-6">
      {done ? (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Report sent</h2>
          {/* Honest about what happens next: there is no automated action and
              no admin tooling yet, and implying otherwise would be worse than
              saying so. */}
          <p className="mt-2 text-sm text-gray-500">
            Thanks. A moderator will review this. Nothing happens automatically, so if this person is
            contacting you, blocking them will stop it right away.
          </p>
          <button type="button" onClick={onClose} className="btn-ghost mt-4">
            Close
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Report</h2>
          <p className="mt-2 text-xs text-gray-500">{REPORTING_GUIDANCE}</p>

          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">Reason</legend>
            {REPORT_CATEGORY_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-panelborder p-2 hover:border-gray-600"
              >
                <input
                  type="radio"
                  name="category"
                  value={o.value}
                  checked={category === o.value}
                  onChange={() => setCategory(o.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm text-gray-200">{o.label}</span>
                  <span className="block text-xs text-gray-500">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              Details (optional)
            </span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={MAX_REPORT_DETAIL}
              className="w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>

          {error && (
            <p className="mt-2 text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy} className="btn-gold">
              {busy ? "Sending..." : "Send report"}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
