"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AdminUserRow } from "@/data/admin";
import type { DeclineReasonDTO, FeatureFlagStateDTO } from "@/data/dto";
import type { SeasonDef } from "@/game/season";

// Code-split: only the active tab's panel needs to be in the bundle at all -
// the other three are dead weight on every admin load otherwise.
const UsersTable = dynamic(() => import("./UsersTable").then((m) => m.UsersTable));
const FeatureFlagsPanel = dynamic(() => import("./FeatureFlagsPanel").then((m) => m.FeatureFlagsPanel));
const DeclineReasonsPanel = dynamic(() => import("./DeclineReasonsPanel").then((m) => m.DeclineReasonsPanel));
const SeasonPanel = dynamic(() => import("./SeasonPanel").then((m) => m.SeasonPanel));

// More admin sections slot in here later without touching the layout.
const SECTIONS = [
  { id: "users", label: "Users" },
  { id: "featureFlags", label: "Feature Flags" },
  { id: "declineReasons", label: "Decline Reasons" },
  { id: "season", label: "Season" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export function AdminClient({
  initialUsers, initialTotal, initialFlags, initialDeclineReasons, seasons, initialCurrentSeasonId,
}: {
  initialUsers: AdminUserRow[];
  initialTotal: number;
  initialFlags: FeatureFlagStateDTO[];
  initialDeclineReasons: DeclineReasonDTO[];
  seasons: SeasonDef[];
  initialCurrentSeasonId: string;
}) {
  const [section, setSection] = useState<Section>("users");

  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start">
      <nav className="flex sm:flex-col gap-1 w-full sm:w-44 shrink-0">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              section === s.id ? "bg-panel2 text-accent" : "text-gray-400 hover:text-white hover:bg-panel2/60"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 min-w-0 w-full">
        {section === "users" && <UsersTable initialUsers={initialUsers} initialTotal={initialTotal} />}
        {section === "featureFlags" && <FeatureFlagsPanel initialFlags={initialFlags} />}
        {section === "declineReasons" && <DeclineReasonsPanel initialReasons={initialDeclineReasons} />}
        {section === "season" && <SeasonPanel seasons={seasons} initialCurrentSeasonId={initialCurrentSeasonId} />}
      </div>
    </div>
  );
}
