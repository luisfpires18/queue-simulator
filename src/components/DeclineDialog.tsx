"use client";

import { useEffect, useState } from "react";
import { useDeclineReasons } from "@/lib/queries";
import { Modal } from "./ui/Modal";
import { cn } from "@/lib/utils";

/** Shared by the M+/raid and team pending-request modals. A reason is
 * required - the applicant is told what it was, so "declined" can't be the
 * whole message. The note is optional and in the decliner's own words. */
export function DeclineDialog({
  open, applicantName, submitting, onCancel, onConfirm,
}: {
  open: boolean;
  applicantName: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reasonId: string, note: string | null) => void;
}) {
  // Shared/cached across every card's dialog instead of a private fetch per
  // open - see useDeclineReasons.
  const { data: reasons } = useDeclineReasons(); // undefined = loading
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setReasonId(null);
    setNote("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      // Above the pending-requests modal that opened it.
      overlayClassName="z-[60]"
      panelClassName="panel w-full max-w-sm max-h-[85vh] overflow-y-auto p-4 space-y-4"
    >
      <div>
        <h3 className="text-sm font-bold">Decline {applicantName}</h3>
        <p className="text-xs text-gray-500 mt-0.5">They&apos;ll see the reason you pick, and your note if you add one.</p>
      </div>

      {reasons === undefined ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : reasons.length === 0 ? (
        <p className="text-sm text-amber-300">
          No decline reasons are configured yet, so declining isn&apos;t possible. An admin adds them under Admin -&gt; Decline Reasons.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {reasons.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReasonId(r.id)}
                className={cn(
                  "w-full text-left rounded-md border px-3 py-2 text-sm transition-colors",
                  reasonId === r.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-panelborder text-gray-300 hover:border-gray-500"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={submitting}
              className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm outline-none focus:border-accent resize-y"
            />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} disabled={submitting} className="btn-ghost flex-1">
          Cancel
        </button>
        <button
          onClick={() => reasonId && onConfirm(reasonId, note.trim() || null)}
          disabled={submitting || !reasonId}
          className="btn bg-rose-600 text-white hover:brightness-110 flex-1 disabled:opacity-50"
        >
          {submitting ? "Declining…" : "Decline"}
        </button>
      </div>
    </Modal>
  );
}
