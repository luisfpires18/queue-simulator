"use client";

import { useState } from "react";
import Image from "next/image";
import { bannerSpec } from "@/game/banners";
import { iconUrl } from "@/game/icons";
import { cn } from "@/lib/utils";

export interface BannerProps {
  bannerType: string;
  /** Explicit class pick; null follows `fallbackClassId`. */
  bannerClassId: string | null;
  /** Stored filename, served from /api/uploads/banners/. */
  bannerImage: string | null;
  /** The viewed account's main character class, used when nothing is picked. */
  fallbackClassId?: string | null;
}

/**
 * Profile header artwork. An uploaded image wins when present; anything else
 * (no upload, a deleted file, a failed request) renders the generated class
 * banner, so this never draws an empty rectangle.
 */
export function ProfileBanner({ bannerType, bannerClassId, bannerImage, fallbackClassId = null, standalone = false }: BannerProps & {
  /** True when the banner isn't sitting on top of a panel (the settings
   * preview) - it closes its own bottom edge instead of butting into one. */
  standalone?: boolean;
}) {
  const [imageBroken, setImageBroken] = useState(false);
  const spec = bannerSpec(bannerClassId ?? fallbackClassId);
  const showImage = bannerType === "upload" && bannerImage && !imageBroken;

  return (
    <div
      className={cn(
        "relative h-32 sm:h-44 overflow-hidden border border-panelborder rounded-t-lg",
        standalone ? "rounded-b-lg" : "border-b-0"
      )}
      style={showImage ? undefined : { background: spec.background }}
    >
      {showImage ? (
        // Same-origin upload, above the fold - next/image handles sizing/
        // format for this one; the small decorative watermark below stays a
        // plain <img> (external CDN, low visual weight, see WowIcon.tsx).
        <Image
          src={`/api/uploads/banners/${bannerImage}`}
          alt=""
          fill
          sizes="100vw"
          priority
          onError={() => setImageBroken(true)}
          className="object-cover"
          draggable={false}
        />
      ) : (
        spec.watermarkSlug && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl(spec.watermarkSlug)}
            alt=""
            decoding="async"
            className="pointer-events-none absolute -right-6 -top-8 h-[190%] w-auto opacity-[0.07] mix-blend-screen"
            draggable={false}
          />
        )
      )}
      {/* Scrim so the status chip sitting on the seam stays legible over any image. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-panel to-transparent" />
    </div>
  );
}
