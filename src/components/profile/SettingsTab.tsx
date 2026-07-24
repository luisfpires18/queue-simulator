"use client";

import { useEffect, useState } from "react";
import { CountrySelect } from "@/components/CountrySelect";

interface Settings {
  showBattletag: boolean;
  country: string | null;
  discord: string | null;
  twitch: string | null;
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({ showBattletag: false, country: null, discord: null, twitch: null });
  // Local text-field drafts - the server normalizes on save (see
  // normalizeTwitchHandle/normalizeDiscordHandle), so echoing that back into
  // the input on every keystroke would fight the user mid-typing.
  const [discordDraft, setDiscordDraft] = useState("");
  const [twitchDraft, setTwitchDraft] = useState("");

  useEffect(() => {
    fetch("/api/profile/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = {
          showBattletag: data.showBattletag ?? false,
          country: data.country ?? null,
          discord: data.discord ?? null,
          twitch: data.twitch ?? null,
        };
        setSettings(next);
        setDiscordDraft(next.discord ?? "");
        setTwitchDraft(next.twitch ?? "");
      })
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
          <span className="block text-sm font-bold text-gray-200">Show battletag on public profile</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            When off, your public profile (/u/…) shows your character name instead of your battletag.
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
        <p className="text-[11px] text-gray-500 mt-1.5">Shown as a flag next to your name on your public profile.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Discord</label>
        <input
          type="text"
          value={discordDraft}
          onChange={(e) => setDiscordDraft(e.target.value)}
          onBlur={() => discordDraft !== (settings.discord ?? "") && update({ ...settings, discord: discordDraft || null })}
          placeholder="username or Name#0001"
          maxLength={100}
          className="w-full max-w-xs rounded-md border border-panelborder bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="text-[11px] text-gray-500 mt-1.5">Shown as text on your public profile - not a link.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Twitch</label>
        <input
          type="text"
          value={twitchDraft}
          onChange={(e) => setTwitchDraft(e.target.value)}
          onBlur={() => twitchDraft !== (settings.twitch ?? "") && update({ ...settings, twitch: twitchDraft || null })}
          placeholder="channel name or twitch.tv/channel"
          maxLength={200}
          className="w-full max-w-xs rounded-md border border-panelborder bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="text-[11px] text-gray-500 mt-1.5">Linked on your public profile - shows a live preview when you're streaming.</p>
      </div>
    </div>
  );
}
