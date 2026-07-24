"use client";

import type { ChatGroupSummaryDTO } from "@/data/dto";
import { useChatDock } from "./ChatDockContext";

const GroupGlyphIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
    <circle cx="6" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="11.5" cy="6" r="1.7" stroke="currentColor" strokeWidth="1.2" />
    <path d="M9.7 9.8c.5-.3 1.1-.5 1.8-.5 1.8 0 3.3 1.1 3.3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/** A Team Group as a compact circle card, same footprint as FriendCircle so
 * they read as one family of "who can I talk to" tiles — click anywhere to
 * open the group's dock thread. */
export function GroupCircle({ group }: { group: ChatGroupSummaryDTO }) {
  const { openChat } = useChatDock();

  return (
    <button
      onClick={() => openChat({ kind: "group", groupId: group.id })}
      className="relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-panel2/60 transition-colors"
    >
      {group.unreadCount > 0 && (
        <span className="absolute top-1 left-1 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-black text-[9px] font-bold grid place-items-center leading-none">
          {group.unreadCount}
        </span>
      )}

      <div className="w-[52px] h-[52px] mt-1.5 rounded-full bg-panel2 border border-panelborder grid place-items-center text-gray-400">
        <GroupGlyphIcon />
      </div>

      <span className="text-xs font-bold text-center truncate w-full text-gray-100">{group.name}</span>
      <span className="text-[10px] text-gray-500">
        {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
      </span>
    </button>
  );
}
