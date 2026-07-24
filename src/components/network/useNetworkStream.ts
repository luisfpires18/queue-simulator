"use client";

import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { FriendDTO } from "@/data/dto";
import { queryKeys } from "@/lib/queries";
import type { NetworkEvent } from "@/server/network/broadcaster";

// Module-level singleton: RootLayout renders AccountMenu in both the desktop
// header and the mobile drawer (both always mounted, CSS just hides one), so
// useNetworkStream can get called by more than one component instance in the
// same tab. Ref-counted so exactly one EventSource exists per tab regardless
// of how many call sites are mounted.
let sharedSource: EventSource | null = null;
let refCount = 0;
const eventHandlers = new Set<(event: NetworkEvent) => void>();
const liveHandlers = new Set<(live: boolean) => void>();

function ensureSource(): EventSource {
  if (sharedSource) return sharedSource;
  const es = new EventSource("/api/stream/network");
  es.addEventListener("network", (e) => {
    let event: NetworkEvent;
    try {
      event = JSON.parse((e as MessageEvent).data);
    } catch {
      return;
    }
    liveHandlers.forEach((h) => h(true));
    eventHandlers.forEach((h) => h(event));
  });
  es.onerror = () => liveHandlers.forEach((h) => h(false));
  sharedSource = es;
  return es;
}

function applyEvent(queryClient: QueryClient, event: NetworkEvent) {
  if (event.type === "friend_request" || event.type === "friend_resolved" || event.type === "friend_removed") {
    queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
  } else if (event.type === "message") {
    queryClient.invalidateQueries({ queryKey: queryKeys.messages(event.senderId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.messages(event.recipientId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
  } else if (event.type === "presence") {
    queryClient.setQueryData<FriendDTO[]>(queryKeys.friends, (old) =>
      old?.map((f) => (f.userId === event.userId ? { ...f, online: event.online } : f))
    );
  } else if (event.type === "chat_group_message") {
    queryClient.invalidateQueries({ queryKey: queryKeys.chatGroupMessages(event.chatGroupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.chatGroups });
  } else if (event.type === "chat_group_updated") {
    queryClient.invalidateQueries({ queryKey: queryKeys.chatGroup(event.chatGroupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.chatGroups });
  }
}

/** Subscribes the signed-in user to /api/stream/network. Safe to call from
 * multiple components at once (see the singleton above) — react-query's
 * cache is shared app-wide, so every mounted useFriends/useFriendRequests/
 * useMessages query sees the same invalidations/patches regardless of which
 * call site is driving the connection.
 *
 * Most events invalidate-and-refetch (low-volume, simplest to reason about);
 * presence is the exception — it can fire often as friends' tabs open/close,
 * so it patches the cached online flag directly instead of round-tripping. */
export function useNetworkStream() {
  const [live, setLive] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    refCount++;
    ensureSource();

    const onLive = (v: boolean) => setLive(v);
    const onEvent = (event: NetworkEvent) => applyEvent(queryClient, event);
    liveHandlers.add(onLive);
    eventHandlers.add(onEvent);
    setLive(sharedSource?.readyState === EventSource.OPEN);

    return () => {
      liveHandlers.delete(onLive);
      eventHandlers.delete(onEvent);
      refCount--;
      if (refCount <= 0) {
        sharedSource?.close();
        sharedSource = null;
        refCount = 0;
      }
    };
  }, [queryClient]);

  return { live };
}
