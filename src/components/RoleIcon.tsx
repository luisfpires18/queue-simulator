import type { Role } from "@/game/classes";
import { cn } from "@/lib/utils";

// Self-hosted (public/role-icons/) rather than hotlinked — raider.io's own
// role-icon URLs are webpack build-hashed asset paths with no stability
// guarantee, unlike their versioned public API.
const ROLE_ICON_SRC: Record<Role, string> = {
  TANK: "/role-icons/tank.png",
  HEALER: "/role-icons/healer.png",
  DPS: "/role-icons/dps.png",
};
const ROLE_LABEL: Record<Role, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export function RoleIcon({
  role, size = 20, rounded = "md", className, title,
}: {
  role: Role;
  size?: number;
  rounded?: "md" | "sm" | "full";
  className?: string;
  title?: string;
}) {
  const radius = rounded === "full" ? "rounded-full" : rounded === "sm" ? "rounded-sm" : "rounded-md";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ROLE_ICON_SRC[role]}
      alt={title ?? ROLE_LABEL[role]}
      title={title ?? ROLE_LABEL[role]}
      width={size}
      height={size}
      loading="lazy"
      className={cn(radius, "object-contain select-none", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
