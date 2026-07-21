import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPES } from "./registry";
import { sendPush } from "./webpush";
import type { NotificationMessage } from "./types";

// Fire-and-forget from trigger sites: notify("group_created", g).catch(console.error).
// Looks up every enabled, matching user's push subscriptions and sends to each.
export async function notify(type: string, payload: any): Promise<void> {
  const definition = NOTIFICATION_TYPES[type];
  if (!definition) throw new Error(`Unknown notification type: ${type}`);

  const excludeUserId = definition.excludeUserId?.(payload);

  const prefs = await prisma.notificationPreference.findMany({
    where: { enabled: true, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
    include: { user: { include: { pushSubscriptions: true } } },
  });

  const recipients = prefs.filter((pref) => {
    let settings: any = {};
    try {
      settings = JSON.parse(pref.settings);
    } catch {
      settings = {};
    }
    return definition.matches(settings, payload);
  });
  if (recipients.length === 0) return;

  const message = definition.build(payload);

  await Promise.all(
    recipients.flatMap((pref) =>
      pref.user.pushSubscriptions.map(async (sub) => {
        const { dead } = await sendPush(sub, message);
        if (dead) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      })
    )
  );
}

// Direct, single-user push that RESPECTS a per-type opt-out.
//
// Sits between notify() and notifyUser(): the message is built by the caller
// (it needs data the registry cannot see), but the registry entry decides
// whether this user still wants that type. Unlike the broadcast path, the
// default is ON — these fire because of something the recipient is already
// part of, and defaulting them off would mean nobody ever hears that their
// application was accepted.
export async function notifyUserTyped(
  userId: string,
  type: string,
  message: NotificationMessage
): Promise<void> {
  const definition = NOTIFICATION_TYPES[type];
  if (!definition) throw new Error(`Unknown notification type: ${type}`);

  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (pref) {
    let settings: any = {};
    try {
      settings = JSON.parse(pref.settings);
    } catch {
      settings = {};
    }
    // No preference row at all means the user has never touched settings, so
    // the default applies and the push goes out.
    if (!definition.matches(settings, { message })) return;
  }

  await notifyUser(userId, message);
}

// Direct, single-user push — bypasses NotificationPreference entirely. For
// transactional feedback on the user's own action (e.g. "your application was
// accepted"), not the opt-in broadcast digest `notify()` handles. Silently
// does nothing if that user has no push subscriptions (or push isn't set up).
export async function notifyUser(userId: string, message: NotificationMessage): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (sub) => {
      const { dead } = await sendPush(sub, message);
      if (dead) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    })
  );
}
