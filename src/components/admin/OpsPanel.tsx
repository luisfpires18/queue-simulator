"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { OpsAction, OpsResult } from "@/server/adminOps";

interface ActionDef {
  action: OpsAction;
  label: string;
  description: string;
  danger: boolean;
}

export function OpsPanel({ actions }: { actions: readonly ActionDef[] }) {
  const [busy, setBusy] = useState<OpsAction | null>(null);
  const [confirming, setConfirming] = useState<OpsAction | null>(null);
  const [results, setResults] = useState<Record<string, OpsResult>>({});
  const [error, setError] = useState<string | null>(null);

  async function run(action: OpsAction) {
    setBusy(action);
    setConfirming(null);
    setError(null);
    try {
      const res = await apiPost<{ result: OpsResult }>("/api/admin/ops", { action });
      setResults((r) => ({ ...r, [action]: res.result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="panel px-4 py-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {actions.map((a) => {
        const result = results[a.action];
        const isConfirming = confirming === a.action;
        const isBusy = busy === a.action;

        return (
          <section key={a.action} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white">{a.label}</h2>
                <p className="mt-0.5 text-xs text-gray-500">{a.description}</p>
              </div>

              {!isConfirming && (
                <button
                  type="button"
                  // Everything here confirms - even the safe one, so the
                  // interaction is the same shape every time and a click is
                  // never a surprise.
                  onClick={() => setConfirming(a.action)}
                  disabled={!!busy}
                  className={a.danger ? "btn-ghost hover:text-rose-300" : "btn-ghost"}
                >
                  {isBusy ? "Running..." : "Run"}
                </button>
              )}
            </div>

            {isConfirming && (
              <div
                className={`mt-3 rounded-md border p-3 ${
                  a.danger ? "border-rose-500/40 bg-rose-500/5" : "border-panelborder bg-panel2/50"
                }`}
              >
                <p className="text-sm text-gray-200">Run &quot;{a.label}&quot; now?</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => run(a.action)} disabled={!!busy} className="btn-gold">
                    Yes, run it
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="btn-ghost">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="mt-3 rounded-md border border-panelborder bg-panel2/50 p-3">
                <p className="text-sm text-gray-200">{result.message}</p>
                {result.detail && (
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(result.detail).map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-1">
                        <dt className="text-[11px] text-gray-600">{k}</dt>
                        <dd className="text-[11px] tabular-nums text-gray-300">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
