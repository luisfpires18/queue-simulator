"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CountrySelect } from "@/components/CountrySelect";

// Code-split: the banner image-picker UI is only visible when the Settings
// tab is active, so it shouldn't ship in the main profile bundle.
const BannerPicker = dynamic(() => import("./BannerPicker").then((m) => m.BannerPicker));

export interface Settings {
  showBattletag: boolean;
  country: string | null;
  discord: string | null;
  twitch: string | null;
  aboutMe: string | null;
  bannerType: string;
  bannerClassId: string | null;
  bannerImage: string | null;
  lftStatus: string;
}

/** `initialSettings` comes straight from the profile page's own server
 * render (the same User row ProfileOverview reads) - the exact shape
 * /api/profile/settings GET returns, so this tab never needs its own fetch
 * on mount. */
export function SettingsTab({
  initialSettings, mainClassId = null, hasTeam = false,
}: { initialSettings: Settings; mainClassId?: string | null; hasTeam?: boolean }) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  // Local text-field drafts - the server normalizes on save (see
  // normalizeTwitchHandle/normalizeDiscordHandle), so echoing that back into
  // the input on every keystroke would fight the user mid-typing.
  const [discordDraft, setDiscordDraft] = useState(initialSettings.discord ?? "");
  const [twitchDraft, setTwitchDraft] = useState(initialSettings.twitch ?? "");
  const [aboutDraft, setAboutDraft] = useState(initialSettings.aboutMe ?? "");

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

  return (
    <div className="panel p-5 space-y-5">
      <BannerPicker
        value={settings}
        mainClassId={mainClassId}
        onPickClass={(bannerClassId) => update({ ...settings, bannerClassId })}
        // The banner route has already written these - just mirror them.
        onUploadChange={(next) => setSettings((s) => ({ ...s, ...next }))}
      />

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">About me</label>
        <textarea
          value={aboutDraft}
          onChange={(e) => setAboutDraft(e.target.value)}
          onBlur={() => aboutDraft.trim() !== (settings.aboutMe ?? "") && update({ ...settings, aboutMe: aboutDraft.trim() || null })}
          rows={5}
          maxLength={1000}
          className="w-full rounded-md border border-panelborder bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent resize-y"
        />
        <p className="text-[11px] text-gray-500 mt-1.5">
          {aboutDraft.length}/1000 - shown on your public profile. Leave empty to show nothing.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Team status</label>
        <label className={`flex items-start gap-2 ${hasTeam ? "opacity-60" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            disabled={hasTeam}
            checked={settings.lftStatus === "lft"}
            onChange={(e) => update({ ...settings, lftStatus: e.target.checked ? "lft" : "none" })}
            className="mt-0.5 accent-accent"
          />
          <span>
            <span className="block text-sm font-bold text-gray-200">Looking for a team</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              {hasTeam
                ? "You're already in a team, so your profile shows the team instead."
                : "Your profile shows \"Looking For Team\" instead of \"No Team\"."}
            </span>
          </span>
        </label>
      </div>

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
