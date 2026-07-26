"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ChatThreadId = { kind: "dm"; userId: string } | { kind: "group"; groupId: string };

export function threadKey(thread: ChatThreadId): string {
  return thread.kind === "dm" ? `dm:${thread.userId}` : `group:${thread.groupId}`;
}

function sameThread(a: ChatThreadId, b: ChatThreadId): boolean {
  return threadKey(a) === threadKey(b);
}

export interface OpenChat {
  thread: ChatThreadId;
  minimized: boolean;
}

interface ChatDockValue {
  /** The signed-in user's own id — group thread bubbles need this to tell
   * "mine" from "theirs" against potentially many senders (DMs used to get
   * away with "not the friend", which doesn't generalize). Undefined only
   * very briefly before RootLayout's session resolves. */
  currentUserId: string | undefined;
  openChats: OpenChat[];
  fullscreenThread: ChatThreadId | null;
  openChat: (thread: ChatThreadId) => void;
  closeChat: (thread: ChatThreadId) => void;
  toggleMinimize: (thread: ChatThreadId) => void;
  enterFullscreen: (thread: ChatThreadId) => void;
  exitFullscreen: () => void;
}

const ChatDockContext = createContext<ChatDockValue | null>(null);

const MAX_OPEN = 3; // Facebook-style cap — opening a 4th bumps the oldest

// Below this, there's no room for side-by-side floating windows (that's a
// desktop affordance) — opening a chat goes straight to the fullscreen
// overlay instead, which is how every mobile chat surface behaves anyway.
const MOBILE_BREAKPOINT_PX = 640;

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX;
}

export function ChatDockProvider({ children, currentUserId }: { children: React.ReactNode; currentUserId?: string }) {
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [fullscreenThread, setFullscreenThread] = useState<ChatThreadId | null>(null);

  // ChatDockProvider lives at the root layout and never unmounts across
  // login/logout (no hard reload happens) - without this, a previous
  // session's open dock windows (and whatever they'd show) linger for
  // whoever's using the browser next, logged out or as a different account.
  const prevUserId = useRef(currentUserId);
  useEffect(() => {
    if (prevUserId.current !== currentUserId) {
      setOpenChats([]);
      setFullscreenThread(null);
      prevUserId.current = currentUserId;
    }
  }, [currentUserId]);

  const openChat = useCallback((thread: ChatThreadId) => {
    setOpenChats((prev) => {
      if (prev.some((c) => sameThread(c.thread, thread))) {
        return prev.map((c) => (sameThread(c.thread, thread) ? { ...c, minimized: false } : c));
      }
      const next = [...prev, { thread, minimized: false }];
      return next.length > MAX_OPEN ? next.slice(next.length - MAX_OPEN) : next;
    });
    if (isMobileViewport()) setFullscreenThread(thread);
  }, []);

  const closeChat = useCallback((thread: ChatThreadId) => {
    setOpenChats((prev) => prev.filter((c) => !sameThread(c.thread, thread)));
    setFullscreenThread((cur) => (cur && sameThread(cur, thread) ? null : cur));
  }, []);

  const toggleMinimize = useCallback((thread: ChatThreadId) => {
    setOpenChats((prev) => prev.map((c) => (sameThread(c.thread, thread) ? { ...c, minimized: !c.minimized } : c)));
  }, []);

  const enterFullscreen = useCallback((thread: ChatThreadId) => setFullscreenThread(thread), []);
  const exitFullscreen = useCallback(() => setFullscreenThread(null), []);

  const value = useMemo(
    () => ({ currentUserId, openChats, fullscreenThread, openChat, closeChat, toggleMinimize, enterFullscreen, exitFullscreen }),
    [currentUserId, openChats, fullscreenThread, openChat, closeChat, toggleMinimize, enterFullscreen, exitFullscreen]
  );

  return <ChatDockContext.Provider value={value}>{children}</ChatDockContext.Provider>;
}

export function useChatDock(): ChatDockValue {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used within ChatDockProvider");
  return ctx;
}
