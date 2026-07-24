"use client";

import { useState } from "react";
import type { FeatureFlagStateDTO } from "@/data/dto";

export function FeatureFlagsPanel({ initialFlags }: { initialFlags: FeatureFlagStateDTO[] }) {
  const [flags, setFlags] = useState(initialFlags);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: string, enabled: boolean) {
    setSavingKey(key);
    setError(null);
    // Optimistic - most toggles succeed; revert on failure below.
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
      setError(`Failed to update "${key}" - try again.`);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{error}</p>
      )}
      <div className="space-y-2">
        {flags.map((f) => (
          <label
            key={f.key}
            className="flex items-start gap-3 rounded-md border border-panelborder bg-panel2/40 p-3 cursor-pointer hover:border-accent/50"
          >
            <input
              type="checkbox"
              checked={f.enabled}
              disabled={savingKey === f.key}
              onChange={(e) => toggle(f.key, e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-gray-200">{f.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{f.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
