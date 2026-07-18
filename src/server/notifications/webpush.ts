import webpush from "web-push";
import type { NotificationMessage } from "./types";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails("mailto:noreply@mplus-queue-sim.local", publicKey, privateKey);
  configured = true;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Returns true if the subscription is dead (404/410) and its DB row should be pruned.
export async function sendPush(sub: StoredSubscription, message: NotificationMessage): Promise<{ dead: boolean }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(message)
    );
    return { dead: false };
  } catch (err: any) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) return { dead: true };
    console.error("push send failed", status, err?.body ?? err);
    return { dead: false };
  }
}
