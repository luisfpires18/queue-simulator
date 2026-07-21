"use client";

import { useEffect, useState } from "react";
import { CountrySelect } from "@/components/CountrySelect";

interface Settings {
  showBattletag: boolean;
  country: string | null;
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({ showBattletag: true, country: null });

  useEffect(() => {
    fetch("/api/profile/settings")
      .then((res) => res.json())
      .then((data) => setSettings({ showBattletag: data.showBattletag ?? true, country: data.country ?? null }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Always saves immediately on change - no separate Save button, matching
  // NotificationsTab's convention.
  const update = (next: Settings) => {
    setSettings(next);
    fetch("/api/profile/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
  };

  if (loading) return <div className="panel p-10 text-center text-gray-500">Loading…</div>;

  return (
    <div className="panel p-5 space-y-5">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.showBattletag}
          onChange={(e) => update({ ...settings, showBattletag: e.target.checked })}
          className="mt-0.5 accent-accent"
        />
        <span>
          <span className="block text-sm font-bold text-gray-200">Show my battletag on my profile</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Turn it off and your profile shows a character name instead of your battletag.
          </span>
        </span>
      </label>

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
          Country
        </label>
        <CountrySelect
          value={settings.country}
          onChange={(country) => update({ ...settings, country })}
        />
        <p className="text-[11px] text-gray-500 mt-1.5">Shows as a little flag next to your name.</p>
      </div>
    </div>
  );
}
