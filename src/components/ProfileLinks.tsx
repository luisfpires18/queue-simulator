"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// White backing circle regardless of theme - both sites' favicons have
// transparent PNG margins that nearly vanish against this app's dark
// panels without one (that was the earlier "icons aren't showing" bug -
// the images WERE loading, just invisible at low opacity on a dark bg).
function LinkIcon({ domain, alt, href, title }: { domain: string; alt: string; href: string; title: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl(domain)}
        width={16}
        height={16}
        alt={alt}
        className="block rounded-full bg-white p-[1px] ring-1 ring-black/30"
      />
    </a>
  );
}

function LinkIcons({ name, realmSlug, region }: { name: string; realmSlug: string; region: string }) {
  return (
    <>
      <LinkIcon
        domain="raider.io"
        alt="Raider.IO"
        title="Raider.IO profile"
        href={`https://raider.io/characters/${region}/${realmSlug}/${encodeURIComponent(name)}`}
      />
      <LinkIcon
        domain="warcraftlogs.com"
        alt="Warcraft Logs"
        title="Warcraft Logs profile"
        href={`https://www.warcraftlogs.com/character/${region}/${realmSlug}/${encodeURIComponent(name)}`}
      />
    </>
  );
}

/** Corner-badge variant - ONLY for a real square icon card (e.g.
 * CharacterCard's 56px class-icon square), absolutely positioned over its
 * top-right corner. Don't use this in a list/row context - see
 * ProfileLinkIcons below for that. */
export function ProfileLinkBadges({
  name, realmSlug, region,
}: {
  name: string;
  realmSlug: string;
  region: string;
}) {
  return (
    <div className="absolute -top-1.5 -right-1.5 flex gap-1 z-10">
      <LinkIcons name={name} realmSlug={realmSlug} region={region} />
    </div>
  );
}

/** Inline (non-absolute) variant - for list/row contexts (RatingDetails,
 * applicant rows) where there's no square icon to overlay a corner onto;
 * sits inline next to the name, same slot as the copy button. */
export function ProfileLinkIcons({
  name, realmSlug, region,
}: {
  name: string;
  realmSlug: string;
  region: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <LinkIcons name={name} realmSlug={realmSlug} region={region} />
    </div>
  );
}

/** Copy-Name-Realm button (for /invite or /w) — meant to sit right next to a
 * character's name text. */
export function CopyNameButton({
  name, realm, size = "sm",
}: {
  name: string;
  realm: string;
  size?: "sm" | "xs";
}) {
  const [copied, setCopied] = useState(false);

  async function copyNameRealm() {
    try {
      await navigator.clipboard.writeText(`${name}-${realm.replace(/\s+/g, "")}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (non-secure context, permissions) — silently no-op
    }
  }

  return (
    <button
      onClick={copyNameRealm}
      title="Copy Name-Realm (for /invite or /w)"
      className={cn(size === "xs" ? "text-[9px]" : "text-[10px]", "text-gray-500 hover:text-gray-200 shrink-0")}
    >
      {copied ? "Copied!" : "📋"}
    </button>
  );
}

/** Simple combined layout (icons + copy button, all inline) — used anywhere
 * that doesn't need the corner-badge/next-to-name split above. */
export function ProfileLinks({
  name, realm, realmSlug, region, size = "sm",
}: {
  name: string;
  realm: string;
  realmSlug: string;
  region: string;
  size?: "sm" | "xs";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <ProfileLinkIcons name={name} realmSlug={realmSlug} region={region} />
      <CopyNameButton name={name} realm={realm} size={size} />
    </div>
  );
}
