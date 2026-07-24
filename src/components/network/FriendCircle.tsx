"use client";

import Link from "next/link";
import type { FriendDTO } from "@/data/dto";
import { classById } from "@/game/classes";
import { classIconSlug } from "@/game/icons";
import { WowIcon } from "@/components/WowIcon";
import { useChatDock } from "./ChatDockContext";
import { cn } from "@/lib/utils";

const ChatIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
    <path
      d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6A2.5 2.5 0 0 1 14.5 14H9l-4 3v-3H5.5A2.5 2.5 0 0 1 3 11.5v-6Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const ProfileIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
    <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 16.5c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const RemoveIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="w-3 h-3">
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** A friend as a compact circle card: class-icon avatar with an online
 * badge, name, and two action icons (view public profile / message).
 * Remove-friend sits in the card's own top-right corner, unread count in
 * the top-left — dense enough to fit several per row in a grid. */
export function FriendCircle({
  friend, busy, onRemove,
}: {
  friend: FriendDTO;
  busy: boolean;
  onRemove: () => void;
}) {
  const { openChat } = useChatDock();
  const { identity } = friend;
  const cls = identity.classId ? classById(identity.classId) : undefined;
  const nameColor = cls?.color ?? "#e5e7eb";
  const label = identity.characterName ?? identity.battletag?.split("#")[0] ?? "Unknown";
  const profileHref =
    identity.characterRealmSlug && identity.characterName
      ? `/u/${encodeURIComponent(identity.characterRealmSlug)}/${encodeURIComponent(identity.characterName)}`
      : null;

  return (
    <div className="relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 hover:bg-panel2/60 transition-colors">
      <button
        onClick={onRemove}
        disabled={busy}
        title="Remove friend"
        className="absolute top-0.5 right-0.5 w-5 h-5 grid place-items-center rounded-full text-gray-500 hover:text-rose-300 hover:bg-panel2"
      >
        <RemoveIcon />
      </button>

      {friend.unreadCount > 0 && (
        <span className="absolute top-1 left-1 min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-black text-[9px] font-bold grid place-items-center leading-none">
          {friend.unreadCount}
        </span>
      )}

      <div className="relative mt-1.5">
        <WowIcon
          slug={identity.classId ? classIconSlug(identity.classId) : undefined}
          size={52}
          cdnSize="medium"
          rounded="full"
          fallbackGlyph={label.slice(0, 1).toUpperCase()}
          fallbackColor={nameColor}
          className={cn(friend.online ? "" : "grayscale opacity-70")}
        />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel",
            friend.online ? "bg-emerald-400" : "bg-gray-600"
          )}
          title={friend.online ? "Online" : "Offline"}
        />
      </div>

      <span className="text-xs font-bold text-center truncate w-full" style={{ color: nameColor }}>
        {label}
      </span>

      <div className="flex items-center gap-1.5">
        {profileHref ? (
          <Link
            href={profileHref}
            title="View profile"
            className="w-6 h-6 grid place-items-center rounded-full border border-panelborder text-gray-400 hover:border-accent/50 hover:text-accent"
          >
            <ProfileIcon />
          </Link>
        ) : (
          <span className="w-6 h-6" />
        )}
        <button
          onClick={() => openChat({ kind: "dm", userId: friend.userId })}
          title="Message"
          className="w-6 h-6 grid place-items-center rounded-full border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20"
        >
          <ChatIcon />
        </button>
      </div>
    </div>
  );
}
