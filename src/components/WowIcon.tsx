"use client";

import { useState } from "react";
import { iconUrl, type IconSize } from "@/game/icons";
import { cn } from "@/lib/utils";

// Renders a real WoW icon from the zamimg CDN. On load error, falls back to
// a supplied glyph/color so the UI never shows a broken image.
export function WowIcon({
  slug,
  size = 40,
  cdnSize = "large",
  rounded = "md",
  className,
  title,
  fallbackGlyph,
  fallbackColor = "#888",
}: {
  slug: string | null | undefined;
  size?: number;
  cdnSize?: IconSize;
  rounded?: "md" | "sm" | "full";
  className?: string;
  title?: string;
  fallbackGlyph?: string;
  fallbackColor?: string;
}) {
  const [broken, setBroken] = useState(false);
  const radius = rounded === "full" ? "rounded-full" : rounded === "sm" ? "rounded-sm" : "rounded-md";

  if (!slug || broken) {
    return (
      <div
        className={cn(radius, "flex items-center justify-center font-black select-none", className)}
        style={{
          width: size,
          height: size,
          background: `linear-gradient(150deg, ${fallbackColor}33, ${fallbackColor}12)`,
          color: fallbackColor,
          fontSize: size * 0.34,
        }}
        title={title}
      >
        {fallbackGlyph ?? "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl(slug, cdnSize)}
      alt={title ?? slug}
      title={title}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn(radius, "object-cover select-none", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
