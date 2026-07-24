"use client";

import Link from "next/link";
import type { DisplayIdentityDTO, MessageDTO } from "@/data/dto";
import { IdentityBadge } from "./IdentityBadge";
import { ChatThreadBody } from "./ChatThreadBody";

/** Full-page thread at /network/[userId] — a deep-linkable fallback (push
 * notifications, direct links) around the same ChatThreadBody the floating
 * ChatDock windows use. */
export function ChatClient({
  friendUserId, identity, initialMessages,
}: {
  friendUserId: string;
  identity: DisplayIdentityDTO;
  initialMessages: MessageDTO[];
}) {
  return (
    <div
      className="flex flex-col"
      // 100dvh (not vh) so mobile browser chrome showing/hiding doesn't leave
      // a gap or clip the input; safe-area-inset-bottom clears the home
      // indicator on notched phones. 8.5rem = header (3.5rem) + this page's
      // own py-8 (4rem) + this row's own height (~1rem).
      style={{ height: "calc(100dvh - 8.5rem - env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 pb-3 border-b border-panelborder shrink-0">
        <Link href="/network" className="text-gray-500 hover:text-white text-sm">← Network</Link>
        <IdentityBadge identity={identity} size={32} preferBattletag />
      </div>
      <ChatThreadBody thread={{ kind: "dm", userId: friendUserId }} initialDmMessages={initialMessages} />
    </div>
  );
}
