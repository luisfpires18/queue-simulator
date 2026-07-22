"use client";

import { useEffect, useState } from "react";
import { DUNGEONS } from "@/game/season";
import { WowIcon } from "@/components/WowIcon";
import { cn } from "@/lib/utils";

const MIN_KEY = 2;
const MAX_KEY = 25; // matches ListKeyForm/BoardClient's key-level range
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

interface Prefs {
  minLevel: number;
  maxLevel: number;
  excludedDungeons: string[];
}

export function NotificationsTab() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ minLevel: 2, maxLevel: 25, excludedDungeons: [] });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window);
    fetch("/api/notifications/preferences")
      .then((res) => res.json())
      .then((data) => {
        setEnabled(!!data.enabled);
        const g = data.settings?.group_created ?? {};
        setPrefs({
          minLevel: g.minLevel ?? 2,
          maxLevel: g.maxLevel ?? 25,
          excludedDungeons: g.excludedDungeons ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Always saves - not gated on `enabled`, so preferences set up before ever
  // turning notifications on are still there once you do (and vice versa,
  // toggling off doesn't lose your dungeon/level picks).
  const savePreferences = async (nextEnabled: boolean, next: Prefs) => {
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: nextEnabled,
        settings: { group_created: next },
      }),
    });
  };

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Notification permission denied.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      await savePreferences(true, prefs);
      setEnabled(true);
    } catch {
      setMsg("Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      await savePreferences(false, prefs);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const updatePrefs = (next: Prefs) => {
    setPrefs(next);
    savePreferences(enabled, next);
  };

  const toggleDungeon = (id: string) => {
    const excludedDungeons = prefs.excludedDungeons.includes(id)
      ? prefs.excludedDungeons.filter((d) => d !== id)
      : [...prefs.excludedDungeons, id];
    updatePrefs({ ...prefs, excludedDungeons });
  };

  if (loading) return <div className="panel p-10 text-center text-gray-500">Loading…</div>;

  if (!supported) {
    return (
      <div className="panel p-10 text-center text-gray-500">
        Push notifications aren't supported in this browser.
      </div>
    );
  }

  return (
    <div className="panel p-5 space-y-5">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => (e.target.checked ? enable() : disable())}
          className="mt-0.5 accent-accent"
        />
        <span>
          <span className="block text-sm font-bold text-gray-200">Receive push notifications</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Get notified when a new group is listed at a key level you care about, even when this tab isn't open.
          </span>
        </span>
      </label>

      <div className={cn("space-y-5", !enabled && "opacity-40 pointer-events-none")}>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Key level
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_KEY}
              max={prefs.maxLevel}
              value={prefs.minLevel}
              onChange={(e) => {
                const minLevel = Math.min(Math.max(MIN_KEY, Number(e.target.value) || MIN_KEY), prefs.maxLevel);
                updatePrefs({ ...prefs, minLevel });
              }}
              className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-sm text-center tabular-nums"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="number"
              min={prefs.minLevel}
              max={MAX_KEY}
              value={prefs.maxLevel}
              onChange={(e) => {
                const maxLevel = Math.max(Math.min(MAX_KEY, Number(e.target.value) || MAX_KEY), prefs.minLevel);
                updatePrefs({ ...prefs, maxLevel });
              }}
              className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-sm text-center tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            Dungeons
          </label>
          <p className="text-[11px] text-gray-500 mb-2">All included by default. Click one to leave it out.</p>
          <div className="flex flex-wrap gap-2">
            {DUNGEONS.map((d) => {
              const excluded = prefs.excludedDungeons.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDungeon(d.id)}
                  title={excluded ? `${d.name} - excluded, click to include` : `${d.name} - included, click to exclude`}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-[11px]",
                    excluded ? "border-panelborder text-gray-600" : "border-accent bg-accent/10 text-accent"
                  )}
                >
                  <WowIcon slug={d.icon} size={28} cdnSize="small" rounded="sm" className={excluded ? "grayscale opacity-40" : undefined} />
                  {d.abbr}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {msg && <span className="text-sm text-gray-400">{msg}</span>}
    </div>
  );
}
