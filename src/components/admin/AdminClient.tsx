"use client";

import { useState } from "react";
import { UsersTable } from "./UsersTable";
import { FeatureFlagsPanel } from "./FeatureFlagsPanel";
import { SeasonPanel } from "./SeasonPanel";
import type { AdminUserRow } from "@/data/admin";
import type { FeatureFlagStateDTO } from "@/data/dto";
import type { SeasonDef } from "@/game/season";

// More admin sections slot in here later without touching the layout.
const SECTIONS = [
  { id: "users", label: "Users" },
  { id: "featureFlags", label: "Feature Flags" },
  { id: "season", label: "Season" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export function AdminClient({
  initialUsers, initialTotal, initialFlags, seasons, initialCurrentSeasonId,
}: {
  initialUsers: AdminUserRow[];
  initialTotal: number;
  initialFlags: FeatureFlagStateDTO[];
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
        {section === "season" && <SeasonPanel seasons={seasons} initialCurrentSeasonId={initialCurrentSeasonId} />}
      </div>
    </div>
  );
}
