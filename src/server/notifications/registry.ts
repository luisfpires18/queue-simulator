import type { NotificationDefinition, NotificationMessage } from "./types";

interface GroupCreatedPayload {
  ownerUserId: string;
  title: string;
  keyLevel: number | null;
  dungeonId: string | null;
}

// Add a new notification type by adding one entry here — no other file needs
// to change except the call site that triggers it (see src/data/source.ts's
// createGroup for the group_created example).
export const NOTIFICATION_TYPES: Record<string, NotificationDefinition<any>> = {
  group_created: {
    type: "group_created",
    matches: (settings, g: GroupCreatedPayload) => {
      // Raid listings (keyLevel/dungeonId both null) don't participate in
      // this M+-specific notification type.
      if (g.keyLevel == null || g.dungeonId == null) return false;
      const { minLevel = 2, maxLevel = 25, excludedDungeons = [] } = settings?.group_created ?? {};
      if ((excludedDungeons as string[]).includes(g.dungeonId)) return false;
      return g.keyLevel >= minLevel && g.keyLevel <= maxLevel;
    },
    build: (g: GroupCreatedPayload) => ({
      title: `New +${g.keyLevel} listed`,
      body: g.title,
      url: "/",
    }),
    excludeUserId: (g: GroupCreatedPayload) => g.ownerUserId,
    label: "New key listed",
    description: "A new Mythic+ listing appears in your level range.",
    delivery: "broadcast",
  },

  // ---- recruitment (phase 2) ----
  //
  // All "direct": each one is the consequence of something the recipient is
  // already part of - an application they sent, or a listing they own - so
  // they default to ON and these entries provide the opt-OUT. A broadcast
  // default of off would mean nobody ever learns their application was
  // accepted, which is worse than the notification itself.
  //
  // `matches` reads settings[type].enabled, treating a missing value as true.
  recruitment_application_received: {
    type: "recruitment_application_received",
    matches: (settings) => settings?.recruitment_application_received?.enabled !== false,
    build: (p: DirectPayload) => p.message,
    label: "New application",
    description: "Someone applies to one of your recruitment listings.",
    delivery: "direct",
  },
  recruitment_application_status: {
    type: "recruitment_application_status",
    matches: (settings) => settings?.recruitment_application_status?.enabled !== false,
    build: (p: DirectPayload) => p.message,
    label: "Application updates",
    description: "A team or guild moves your application forward, or declines it.",
    delivery: "direct",
  },
  recruitment_trial_offered: {
    type: "recruitment_trial_offered",
    matches: (settings) => settings?.recruitment_trial_offered?.enabled !== false,
    build: (p: DirectPayload) => p.message,
    label: "Trial offers",
    description: "You are offered a trial and need to respond.",
    delivery: "direct",
  },
  recruitment_position_filled: {
    type: "recruitment_position_filled",
    matches: (settings) => settings?.recruitment_position_filled?.enabled !== false,
    build: (p: DirectPayload) => p.message,
    label: "Recruitment complete",
    description: "Your listing fills its last open position and stops being listed.",
    delivery: "direct",
  },
};

/** Direct types build their message at the call site (it needs data the
 * registry has no access to, like the applicant's character name), so the
 * payload just carries it through. The registry entry still owns whether the
 * user wants it. */
export interface DirectPayload {
  message: NotificationMessage;
}

/** The types the settings UI should render a simple on/off toggle for.
 * group_created is excluded: it has bespoke level/dungeon controls already. */
export function toggleableTypes() {
  return Object.values(NOTIFICATION_TYPES).filter((d) => d.delivery === "direct" && d.label);
}
