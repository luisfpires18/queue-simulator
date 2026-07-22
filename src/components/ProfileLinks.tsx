"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Self-hosted, not Google's s2/favicons proxy - that endpoint gets silently
// blocked by mobile ad-blockers and iOS Safari's cross-site-tracking
// protections often enough that the icons just never rendered on real
// phones (they worked fine testing server-side / desktop, where nothing
// blocks it - a same-origin static asset can't be blocked the same way).
// White backing circle regardless of theme - both sites' favicons have
// transparent PNG margins that nearly vanish against this app's dark
// panels without one.
function LinkIcon({ src, alt, href, title }: { src: string; alt: string; href: string; title: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={16}
        height={16}
        alt={alt}
        // w-4 h-4 (explicit CSS px, not just the HTML attributes above) -
        // these badges sit inside an absolutely-positioned wrapper with no
        // intrinsic width, so Tailwind preflight's `img { max-width: 100%;
        // height: auto }` was resolving against a ~0px containing block and
        // collapsing the icon to a couple of pixels regardless of the image
        // itself loading fine - confirmed via a real boundingBox() check.
        className="block w-4 h-4 shrink-0 rounded-full bg-white p-[1px] ring-1 ring-black/30"
      />
    </a>
  );
}

function LinkIcons({ name, realmSlug, region }: { name: string; realmSlug: string; region: string }) {
  return (
    <>
      <LinkIcon
        src="/icons/links/raiderio.png"
        alt="Raider.IO"
        title="Raider.IO profile"
        href={`https://raider.io/characters/${region}/${realmSlug}/${encodeURIComponent(name)}`}
      />
      <LinkIcon
        src="/icons/links/warcraftlogs.png"
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
    // w-max: this sits inside CharacterCard's absolutely-positioned,
    // zero-width corner wrapper - without an explicit width, the browser's
    // shrink-to-fit sizing resolves against that 0px containing block and
    // squeezes both icons down to a couple of pixels each, even though each
    // <img> itself has an explicit w-4. w-max forces sizing off the actual
    // content instead (confirmed via a real getBoundingClientRect() probe).
    <div className="absolute -top-1.5 -right-1.5 flex gap-1 z-10 w-max">
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
