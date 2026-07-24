"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { queryKeys, useFriendshipStatus } from "@/lib/queries";
import { useChatDock } from "./ChatDockContext";

/** Add Friend button for a public profile page — only rendered by the caller
 * when the viewer is logged in and isn't looking at their own profile.
 * Accept/decline/cancel live on /network, not here, since those need the
 * request id (this only knows the target's userId). */
export function AddFriendButton({ targetUserId }: { targetUserId: string }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { openChat } = useChatDock();
  const { data: status } = useFriendshipStatus(targetUserId, true);

  async function sendRequest() {
    setSending(true);
    setError(null);
    try {
      await apiPost("/api/network/requests", { targetUserId });
      queryClient.invalidateQueries({ queryKey: queryKeys.friendshipStatus(targetUserId) });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to send request.");
    } finally {
      setSending(false);
    }
  }

  if (!status || status === "friends") {
    return status === "friends" ? (
      <button
        onClick={() => openChat({ kind: "dm", userId: targetUserId })}
        className="chip border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20"
      >
        Friends · Chat
      </button>
    ) : null;
  }

  if (status === "pending_outgoing") {
    return <span className="chip border border-panelborder text-gray-500">Request sent</span>;
  }

  if (status === "pending_incoming") {
    return (
      <Link href="/network" className="chip border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20">
        Respond to their request
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={sendRequest} disabled={sending} className="chip border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20">
        {sending ? "Sending..." : "Add Friend"}
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
