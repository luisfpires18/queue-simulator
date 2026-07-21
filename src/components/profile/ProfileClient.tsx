"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CharacterBoard } from "./CharacterBoard";
import { ImprovementTab } from "../improvement/ImprovementTab";
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
  const [tab, setTab] = useState<"characters" | "improvement" | "notifications" | "settings">("characters");
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const sync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/characters/sync", { method: "POST" });
      const data = await res.json();
      setMsg(res.ok ? `Pulled in ${data.imported} character${data.imported === 1 ? "" : "s"}.` : data.error ?? "Couldn't sync - try again.");
      router.refresh();
    } catch {
      setMsg("Couldn't sync - try again.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <TabCard
          active={tab === "characters"}
          onClick={() => setTab("characters")}
          icon={MISC_ICON.roster}
          title="Characters"
          description="Pull in your roster, sort your alts, pick your mains."
        />
        <TabCard
          active={tab === "improvement"}
          onClick={() => setTab("improvement")}
          icon={MISC_ICON.parse}
          title="Parse coaching"
          description="See how your runs stack up against the best of your spec."
        />
        <TabCard
          active={tab === "notifications"}
          onClick={() => setTab("notifications")}
          icon={MISC_ICON.bell}
          title="Notifications"
          description="Get a ping when a key opens in your range."
        />
        <TabCard
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          icon={MISC_ICON.settings}
          title="Settings"
          description="Decide what other people see on your profile."
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
          <div className="panel p-10 text-center text-gray-500">Nothing here yet - hit "Sync characters" to pull your roster in.</div>
        ) : (
          <CharacterBoard initial={initial} />
        )
      ) : tab === "improvement" ? (
        <ImprovementTab characters={initial} />
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
