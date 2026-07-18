import type { NotificationDefinition } from "./types";

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
  },
};
