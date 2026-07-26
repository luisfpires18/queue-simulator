"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatGroupMessageDTO, ChatGroupSummaryDTO, FriendDTO, MessageDTO } from "@/data/dto";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { queryKeys, useChatGroupMessages, useMessages } from "@/lib/queries";
import { useChatDock, threadKey, type ChatThreadId } from "./ChatDockContext";

interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  senderName?: string | null; // group threads only — DMs never need it (2 participants, isMine says it all)
}

/** The message list + composer for one thread — everything below the
 * header. Shared by the full-page DM thread (/network/[userId]) and the
 * Facebook-style docked/fullscreen ChatDock windows, for both DMs and Team
 * Groups, so there's one implementation of "render messages, send, mark
 * read" instead of several. Fills its parent's height. */
export function ChatThreadBody({
  thread, initialDmMessages, initialGroupMessages, autoFocus,
}: {
  thread: ChatThreadId;
  initialDmMessages?: MessageDTO[];
  initialGroupMessages?: ChatGroupMessageDTO[];
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { currentUserId } = useChatDock();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Both hooks are always called (rules-of-hooks) but only one is `enabled` —
  // each open thread is its own component instance keyed by thread (see
  // ChatDock), so `thread.kind` never actually changes under a mounted
  // instance; `enabled` just keeps the inapplicable one from fetching.
  const dmQuery = useMessages(thread.kind === "dm" ? thread.userId : "", initialDmMessages, thread.kind === "dm");
  const groupQuery = useChatGroupMessages(thread.kind === "group" ? thread.groupId : "", initialGroupMessages, thread.kind === "group");

  const messages: ThreadMessage[] =
    thread.kind === "dm"
      ? (dmQuery.data ?? []).map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt }))
      : (groupQuery.data ?? []).map((m) => ({
          id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt,
          senderName: m.senderIdentity.battletag ?? m.senderIdentity.characterName ?? "Player",
        }));

  const key = threadKey(thread);

  useEffect(() => {
    const url = thread.kind === "dm" ? `/api/network/messages/${thread.userId}/read` : `/api/network/groups/${thread.groupId}/messages/read`;
    apiPost(url)
      .then(() => {
        // Zero the badge instantly instead of waiting on the next SSE event
        // (those only fire for new messages, never for reads) - then
        // reconcile with the server in case one arrived in the gap.
        if (thread.kind === "dm") {
          queryClient.setQueryData<FriendDTO[]>(queryKeys.friends, (old) =>
            old?.map((f) => (f.userId === thread.userId ? { ...f, unreadCount: 0 } : f))
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.friends });
        } else {
          queryClient.setQueryData<ChatGroupSummaryDTO[]>(queryKeys.chatGroups, (old) =>
            old?.map((g) => (g.id === thread.groupId ? { ...g, unreadCount: 0 } : g))
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.chatGroups });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      if (thread.kind === "dm") {
        const { message } = await apiPost<{ message: MessageDTO }>(`/api/network/messages/${thread.userId}`, { body });
        queryClient.setQueryData<MessageDTO[]>(queryKeys.messages(thread.userId), (old) => [...(old ?? []), message]);
      } else {
        const { message } = await apiPost<{ message: ChatGroupMessageDTO }>(`/api/network/groups/${thread.groupId}/messages`, { body });
        queryClient.setQueryData<ChatGroupMessageDTO[]>(queryKeys.chatGroupMessages(thread.groupId), (old) => [...(old ?? []), message]);
      }
      setDraft("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No messages yet. Say hi.</p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} isMine={m.senderId === currentUserId} />)
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-rose-400 px-3">{error}</p>}

      <div className="flex gap-2 p-2 border-t border-panelborder shrink-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={2000}
          placeholder="Message..."
          // text-base (16px), not text-sm: anything smaller makes iOS Safari
          // auto-zoom the page on focus. sm: down to the normal chip size.
          className="flex-1 min-w-0 rounded-md border border-panelborder bg-panel2 px-3 py-2 text-base sm:text-sm outline-none focus:border-accent"
        />
        <button onClick={send} disabled={sending || !draft.trim()} className="btn-gold px-4 shrink-0">
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message, isMine }: { message: ThreadMessage; isMine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isMine ? "bg-accent/20 text-gray-100" : "bg-panel2 text-gray-200 border border-panelborder"
        }`}
      >
        {!isMine && message.senderName && <p className="text-[11px] font-semibold text-accent/90 mb-0.5">{message.senderName}</p>}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className="text-[10px] text-gray-500 mt-1 text-right">{time}</p>
      </div>
    </div>
  );
}
