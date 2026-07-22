"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CharacterBoard } from "./CharacterBoard";
import { NotificationsTab } from "./NotificationsTab";
import { SettingsTab } from "./SettingsTab";
import { WowIcon } from "@/components/WowIcon";
import { MISC_ICON } from "@/game/icons";
import type { RaidKillDTO } from "@/data/dto";

interface SpecTrack {
  specId: string;
  role: string;
  points: number | null;
  bnetScore: number | null;
  isMain: boolean;
}
interface Character {
  id: string;
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  classId: string;
  level: number;
  ilvl: number | null;
  rating: number | null;
  isMain: boolean;
  bucket: string;
  sortOrder: number;
  wclZone: string | null;
  specTracks: SpecTrack[];
  raidKills: RaidKillDTO[];
}

export function ProfileClient({ initial }: { initial: Character[] }) {
  const [tab, setTab] = useState<"characters" | "notifications" | "settings">("characters");
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const sync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/characters/sync", { method: "POST" });
      const data = await res.json();
      setMsg(res.ok ? `Imported ${data.imported} character${data.imported === 1 ? "" : "s"}.` : data.error ?? "Sync failed");
      router.refresh();
    } catch {
      setMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TabCard
          active={tab === "characters"}
          onClick={() => setTab("characters")}
          icon={MISC_ICON.roster}
          title="Characters"
          description="Sync your roster, arrange buckets, and set main specs."
        />
        <TabCard
          active={tab === "notifications"}
          onClick={() => setTab("notifications")}
          icon={MISC_ICON.bell}
          title="Notifications"
          description="Get pushed when a group opens up at your key level."
        />
        <TabCard
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          icon={MISC_ICON.settings}
          title="Settings"
          description="Control what shows on your public profile."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {tab === "characters" && (
          <>
            {initial.length > 0 && (
              <Link
                href={`/u/${encodeURIComponent((initial.find((c) => c.isMain) ?? initial[0]).realmSlug)}/${encodeURIComponent((initial.find((c) => c.isMain) ?? initial[0]).name)}`}
                className="btn-ghost text-xs px-2 py-1"
                target="_blank"
              >
                View public profile ↗
              </Link>
            )}
            <button onClick={sync} disabled={syncing} className="btn-gold ml-auto">
              {syncing ? "Syncing…" : "Sync characters"}
            </button>
            {msg && <span className="text-sm text-gray-400">{msg}</span>}
          </>
        )}
      </div>

      {tab === "characters" ? (
        initial.length === 0 ? (
          <div className="panel p-10 text-center text-gray-500">No characters yet. Hit "Sync characters".</div>
        ) : (
          <CharacterBoard initial={initial} />
        )
      ) : tab === "notifications" ? (
        <NotificationsTab />
      ) : (
        <SettingsTab />
      )}
    </div>
  );
}

function TabCard({
  active, onClick, icon, title, description,
}: { active: boolean; onClick: () => void; icon: string; title: string; description: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 text-left rounded-lg border p-4 transition-colors ${
        active ? "border-accent bg-panel2" : "border-panelborder bg-panel2/40 hover:border-accent/50"
      }`}
    >
      <WowIcon slug={icon} size={32} cdnSize="medium" rounded="sm" />
      <div>
        <div className={`text-sm font-bold ${active ? "text-accent" : "text-gray-200"}`}>{title}</div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
