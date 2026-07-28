"use client";

import { useState } from "react";
import type { DeclineReasonDTO } from "@/data/dto";

/** The list a group/team owner must pick from when declining someone.
 *
 * Reasons are archived, never deleted: history rows reference them by id, and
 * an admin retiring a reason must not change what an owner already said.
 * Same optimistic-then-revert idiom as FeatureFlagsPanel. */
export function DeclineReasonsPanel({ initialReasons }: { initialReasons: DeclineReasonDTO[] }) {
  const [reasons, setReasons] = useState(initialReasons);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...reasons].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
  );
  const active = sorted.filter((r) => r.active);

  async function patch(id: string, body: Partial<DeclineReasonDTO>, optimistic: (r: DeclineReasonDTO) => DeclineReasonDTO) {
    const previous = reasons;
    setBusyId(id);
    setError(null);
    setReasons((prev) => prev.map((r) => (r.id === id ? optimistic(r) : r)));
    try {
      const res = await fetch(`/api/admin/decline-reasons/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
    } catch {
      setReasons(previous);
      setError("Failed to save - try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    const label = draft.trim();
    if (!label) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/decline-reasons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReasons((prev) => [...prev, data.reason]);
      setDraft("");
    } catch {
      setError("Could not add that reason.");
    } finally {
      setAdding(false);
    }
  }

  /** Swaps sortOrder with the neighbour above/below, within the active list. */
  async function move(id: string, dir: -1 | 1) {
    const i = active.findIndex((r) => r.id === id);
    const other = active[i + dir];
    if (!other) return;
    const self = active[i];
    // Two independent PATCHes; if the second fails the first stands, which is
    // harmless - order is cosmetic and the admin can just drag it again.
    await patch(self.id, { sortOrder: other.sortOrder }, (r) => ({ ...r, sortOrder: other.sortOrder }));
    await patch(other.id, { sortOrder: self.sortOrder }, (r) => ({ ...r, sortOrder: self.sortOrder }));
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{error}</p>}

      <p className="text-xs text-gray-500">
        Shown when a leader declines an applicant. Archiving keeps past declines readable but removes the reason from the picker.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          maxLength={80}
          className="flex-1 max-w-sm bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button onClick={add} disabled={adding || !draft.trim()} className="btn-gold text-sm disabled:opacity-50">
          {adding ? "Adding…" : "Add reason"}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="panel p-6 text-center text-sm text-gray-500">
          No reasons yet. Leaders can&apos;t decline anyone until at least one exists.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r) => {
            const idx = active.findIndex((a) => a.id === r.id);
            return (
              <div
                key={r.id}
                className={`flex items-center gap-2 rounded-md border border-panelborder bg-panel2/40 p-2.5 ${
                  r.active ? "" : "opacity-50"
                }`}
              >
                <input
                  type="text"
                  defaultValue={r.label}
                  maxLength={80}
                  disabled={busyId === r.id}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (label && label !== r.label) patch(r.id, { label }, (x) => ({ ...x, label }));
                  }}
                  className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-panelborder text-sm outline-none"
                />
                {r.active && (
                  <>
                    <button
                      onClick={() => move(r.id, -1)}
                      disabled={idx <= 0 || busyId != null}
                      className="text-gray-500 hover:text-white text-xs disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(r.id, 1)}
                      disabled={idx === active.length - 1 || busyId != null}
                      className="text-gray-500 hover:text-white text-xs disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </>
                )}
                <button
                  onClick={() => patch(r.id, { active: !r.active }, (x) => ({ ...x, active: !r.active }))}
                  disabled={busyId === r.id}
                  className="chip border border-panelborder text-gray-400 hover:border-accent/60 disabled:opacity-50"
                >
                  {r.active ? "Archive" : "Restore"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
