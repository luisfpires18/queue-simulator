"use client";

import { useState } from "react";
import type { DisplayIdentityDTO } from "@/data/dto";
import { classById } from "@/game/classes";
import { classIconSlug } from "@/game/icons";
import { WowIcon } from "@/components/WowIcon";
import { IdentityBadge } from "./IdentityBadge";
import { ChatThreadBody } from "./ChatThreadBody";
import { ChatGroupInfoPanel } from "./ChatGroupInfoPanel";
import { useChatDock, threadKey, type ChatThreadId, type OpenChat } from "./ChatDockContext";
import { useChatGroup, useFriends } from "@/lib/queries";
import { cn } from "@/lib/utils";

const EMPTY_IDENTITY: DisplayIdentityDTO = {
  battletag: null, characterName: null, characterRealm: null, characterRealmSlug: null,
  region: null, classId: null, level: null, faction: null,
};

const ExpandIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
    <path d="M6 2H2v4M10 14h4v-4M2 10v4h4M14 6V2h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CompressIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
    <path d="M2 6h4V2M14 10h-4v4M6 10H2v4M10 6h4V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronIcon = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 16 16" fill="none" className={cn("w-3.5 h-3.5 transition-transform", up && "rotate-180")}>
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const InfoIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
    <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 7.3v4M8 5.2v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const GroupGlyphIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
    <circle cx="6" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="11.5" cy="6" r="1.7" stroke="currentColor" strokeWidth="1.2" />
    <path d="M9.7 9.8c.5-.3 1.1-.5 1.8-.5 1.8 0 3.3 1.1 3.3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

function IconButton({
  title, onClick, children, className,
}: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode; className?: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      onClick={onClick}
      className={cn("w-6 h-6 grid place-items-center rounded text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

/** Avatar + label block shared by DockWindow's header and FullscreenChat's
 * header — DM shows the friend's class icon + online dot (from the shared
 * friends cache), group shows a generic icon + name + member count (from
 * useChatGroup). Both hooks are always called (rules-of-hooks); `enabled`
 * just keeps the inapplicable one from fetching. */
function ThreadHeaderInfo({ thread }: { thread: ChatThreadId }) {
  const { data: friends } = useFriends();
  const { data: group } = useChatGroup(thread.kind === "group" ? thread.groupId : "", undefined, thread.kind === "group");

  if (thread.kind === "dm") {
    const friend = friends?.find((f) => f.userId === thread.userId);
    const identity = friend?.identity ?? EMPTY_IDENTITY;
    const label = identity.characterName ?? identity.battletag?.split("#")[0] ?? "Player";
    const cls = identity.classId ? classById(identity.classId) : undefined;
    return (
      <>
        <span className="relative shrink-0">
          <WowIcon
            slug={identity.classId ? classIconSlug(identity.classId) : undefined}
            size={24}
            cdnSize="small"
            rounded="full"
            fallbackGlyph={label.slice(0, 1).toUpperCase()}
            fallbackColor={cls?.color ?? "#888"}
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-panel",
              friend?.online ? "bg-emerald-400" : "bg-gray-600"
            )}
          />
        </span>
        <span className="text-sm font-semibold truncate" style={{ color: cls?.color ?? "#e5e7eb" }}>{label}</span>
      </>
    );
  }

  return (
    <>
      <span className="w-6 h-6 rounded-full bg-panel2 border border-panelborder grid place-items-center shrink-0 text-gray-400">
        <GroupGlyphIcon />
      </span>
      <span className="text-sm font-semibold truncate text-gray-100">{group?.name ?? "Group"}</span>
      {group && <span className="text-[11px] text-gray-500 shrink-0">({group.memberCount})</span>}
    </>
  );
}

/** Facebook-style docked chat: floating windows anchored bottom-right,
 * minimizable, one at a time expandable to a fullscreen overlay. Handles
 * both 1:1 DMs and Team Groups via the ChatThreadId union — openChat() in
 * ChatDockContext only ever needs a thread, not a whole identity. */
export function ChatDock() {
  const { openChats, fullscreenThread } = useChatDock();

  if (fullscreenThread) return <FullscreenChat thread={fullscreenThread} />;
  if (openChats.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-40 flex items-end gap-3">
      {openChats.map((c) => (
        <DockWindow key={threadKey(c.thread)} chat={c} />
      ))}
    </div>
  );
}

function DockWindow({ chat }: { chat: OpenChat }) {
  const { closeChat, toggleMinimize, enterFullscreen } = useChatDock();
  const [infoOpen, setInfoOpen] = useState(false);
  const { thread } = chat;

  return (
    <div
      className={cn(
        "w-80 max-w-[calc(100vw-2rem)] bg-panel border border-panelborder border-b-0 rounded-t-lg shadow-2xl flex flex-col overflow-hidden",
        !chat.minimized && "h-[420px]"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggleMinimize(thread)}
        className="flex items-center gap-2 px-3 py-2 border-b border-panelborder bg-panel2/60 hover:bg-panel2 cursor-pointer shrink-0"
      >
        <ThreadHeaderInfo thread={thread} />
        <span className="ml-auto flex items-center gap-0.5 shrink-0">
          {thread.kind === "group" && (
            <IconButton title="Group info" onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}>
              <InfoIcon />
            </IconButton>
          )}
          <IconButton title="Fullscreen" onClick={(e) => { e.stopPropagation(); enterFullscreen(thread); }}>
            <ExpandIcon />
          </IconButton>
          <IconButton title={chat.minimized ? "Expand" : "Minimize"} onClick={(e) => { e.stopPropagation(); toggleMinimize(thread); }}>
            <ChevronIcon up={chat.minimized} />
          </IconButton>
          <IconButton title="Close" onClick={(e) => { e.stopPropagation(); closeChat(thread); }}>
            <CloseIcon />
          </IconButton>
        </span>
      </div>

      {!chat.minimized && (
        <div className="flex-1 min-h-0">
          <ChatThreadBody thread={thread} autoFocus />
        </div>
      )}

      {thread.kind === "group" && (
        <ChatGroupInfoPanel groupId={thread.groupId} open={infoOpen} onClose={() => setInfoOpen(false)} onLeftOrDeleted={() => closeChat(thread)} />
      )}
    </div>
  );
}

function FullscreenChat({ thread }: { thread: ChatThreadId }) {
  const { exitFullscreen, closeChat } = useChatDock();
  const [infoOpen, setInfoOpen] = useState(false);
  const { data: friends } = useFriends();
  const friend = thread.kind === "dm" ? friends?.find((f) => f.userId === thread.userId) : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-panel flex flex-col">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-panelborder shrink-0">
        {thread.kind === "dm" ? (
          <IdentityBadge identity={friend?.identity ?? EMPTY_IDENTITY} size={32} />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <ThreadHeaderInfo thread={thread} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {thread.kind === "group" && (
            <IconButton title="Group info" onClick={() => setInfoOpen(true)}>
              <InfoIcon />
            </IconButton>
          )}
          {/* No floating dock on mobile (see ChatDockContext's
             isMobileViewport) — restoring there would have nowhere sensible
             to go, so only offer it once there's room for the dock bar. */}
          <IconButton title="Restore" onClick={exitFullscreen} className="hidden sm:grid">
            <CompressIcon />
          </IconButton>
          <IconButton title="Close" onClick={() => closeChat(thread)}>
            <CloseIcon />
          </IconButton>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ChatThreadBody thread={thread} autoFocus />
      </div>

      {thread.kind === "group" && (
        <ChatGroupInfoPanel groupId={thread.groupId} open={infoOpen} onClose={() => setInfoOpen(false)} onLeftOrDeleted={() => closeChat(thread)} />
      )}
    </div>
  );
}
