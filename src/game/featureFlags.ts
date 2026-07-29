// The registry of admin-togglable features (src/components/admin/FeatureFlagsPanel.tsx
// reads this list, src/data/featureFlags.ts merges it against the DB rows).
// Add a new flag by adding one entry here — no other file needs to change
// except the call site(s) that check it, same convention as
// src/server/notifications/registry.ts's NOTIFICATION_TYPES.
export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
}

export const FEATURE_FLAGS: FeatureFlagDef[] = [
  {
    key: "soloQueue",
    label: "Solo Queue",
    description: "Shows the Solo Queue widget on /runs. Off hides it and blocks new joins; players already queued keep matching.",
  },
  {
    key: "expirySweeper",
    label: "Key/Raid Expiry Sweep",
    description: "Hourly background job that auto-delists keys/raids past their start time + grace window. Off saves CPU time (useful on a quota-limited free host) - listings just won't auto-clean until re-enabled; manual delist still works.",
  },
  {
    key: "seasonSnapshotter",
    label: "Season History Snapshot",
    description: "Daily background job that snapshots every character's rating into season history. Off saves CPU time and skips that day's snapshot; past history isn't affected.",
  },
];
