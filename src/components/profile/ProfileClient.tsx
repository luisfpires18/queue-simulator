"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CharacterBoard } from "./CharacterBoard";
import { NotificationsTab } from "./NotificationsTab";
import { FeedbackTab } from "./FeedbackTab";
import { SettingsTab, type Settings } from "./SettingsTab";
import { SeasonSnapshotGrid } from "./SeasonSnapshotGrid";
import { WowIcon } from "@/components/WowIcon";
import { MISC_ICON } from "@/game/icons";
import type { RaidKillDTO } from "@/data/dto";
import type { DeclineHistoryResponse } from "@/lib/queries";

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

export function ProfileClient({
  initial, currentSeasonId, hasTeam, initialSettings, initialFeedback,
}: {
  initial: Character[];
  currentSeasonId: string;
  hasTeam: boolean;
  /** Server-rendered seed for the Settings tab - see SettingsTab. */
  initialSettings: Settings;
  /** Server-rendered seed for the default (received/page-1) Feedback tab
   * view - see FeedbackTab/useDeclineHistory. */
  initialFeedback?: DeclineHistoryResponse;
}) {
  const [tab, setTab] = useState<"characters" | "notifications" | "feedback" | "settings">("characters");
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  // Shared with SeasonSelector (a sibling under the server page, see
  // /profile/page.tsx) via the URL rather than a prop - absent means "live".
  const selectedSeasonId = useSearchParams().get("season") ?? currentSeasonId;
  const viewingPastSeason = selectedSeasonId !== currentSeasonId;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          active={tab === "feedback"}
          onClick={() => setTab("feedback")}
          icon={MISC_ICON.identity}
          title="Feedback"
          description="Declines you've received, and the ones you gave."
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
        {initial.length > 0 && (
          <Link
            href={`/u/${encodeURIComponent((initial.find((c) => c.isMain) ?? initial[0]).realmSlug)}/${encodeURIComponent((initial.find((c) => c.isMain) ?? initial[0]).name)}`}
            className="btn-ghost text-xs px-2 py-1"
            target="_blank"
          >
            View public profile ↗
          </Link>
        )}
        {tab === "characters" && !viewingPastSeason && (
          <>
            <button onClick={sync} disabled={syncing} className="btn-gold ml-auto">
              {syncing ? "Syncing…" : "Sync characters"}
            </button>
            {msg && <span className="text-sm text-gray-400">{msg}</span>}
          </>
        )}
      </div>

      {tab === "characters" ? (
        viewingPastSeason ? (
          <SeasonSnapshotGrid seasonId={selectedSeasonId} />
        ) : initial.length === 0 ? (
          <div className="panel p-10 text-center text-gray-500">No characters yet. Hit "Sync characters".</div>
        ) : (
          <CharacterBoard initial={initial} />
        )
      ) : tab === "notifications" ? (
        <NotificationsTab />
      ) : tab === "feedback" ? (
        <FeedbackTab initialData={initialFeedback} />
      ) : (
        <SettingsTab
          initialSettings={initialSettings}
          mainClassId={(initial.find((c) => c.isMain) ?? initial[0])?.classId ?? null}
          hasTeam={hasTeam}
        />
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
